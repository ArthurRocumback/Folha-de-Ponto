from flask import Flask, render_template, jsonify, request, session, redirect, url_for
import sqlite3
import os
from datetime import timedelta
import requests
import math

# ======================================================
# CONFIGURAÇÃO DA APLICAÇÃO
# ======================================================
app = Flask(__name__, template_folder='templates', static_folder='static')

# Chave de sessão (em produção use variável de ambiente)
app.secret_key = 'ponto_digital_secret'
app.permanent_session_lifetime = timedelta(hours=24)

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
DATABASE = os.path.join(BASE_DIR, 'db_teste.sqlite')

# ======================================================
# CONFIGURAÇÃO DA EMPRESA (GEOFENCE)
# ======================================================
EMPRESA_LAT = -23.550520      # latitude da empresa
EMPRESA_LON = -46.633308      # longitude da empresa
RAIO_METROS = 150             # raio para considerar "Escritório"


# ======================================================
# BANCO DE DADOS
# ======================================================
def get_db_connection():
    """Cria conexão com SQLite"""
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn


# ======================================================
# FUNÇÕES DE LOCALIZAÇÃO
# ======================================================
def calcular_distancia(lat1, lon1, lat2, lon2):
    """
    Calcula distância entre dois pontos (Haversine)
    Retorna metros
    """
    R = 6371000
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)

    a = math.sin(dphi / 2) ** 2 + \
        math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2

    return 2 * R * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def obter_endereco(lat, lon):
    """
    Converte latitude/longitude em endereço legível
    usando OpenStreetMap (Nominatim)
    """
    try:
        url = "https://nominatim.openstreetmap.org/reverse"
        params = {
            "lat": lat,
            "lon": lon,
            "format": "json",
            "accept-language": "pt-BR"
        }
        headers = {"User-Agent": "PontoDigital/1.0"}

        r = requests.get(url, params=params, headers=headers, timeout=5)
        address = r.json().get("address", {})

        bairro = address.get("suburb") or address.get("neighbourhood")
        cidade = address.get("city") or address.get("town")
        estado = address.get("state")

        if bairro:
            return f"{bairro} - {cidade}/{estado}"
        if cidade:
            return f"{cidade} - {estado}"

        return "Localização não identificada"

    except Exception:
        return "Localização não disponível"


# ======================================================
# MIDDLEWARE DE AUTENTICAÇÃO
# ======================================================
@app.before_request
def check_session():
    """
    - Libera login e arquivos estáticos
    - APIs retornam JSON 401
    - Páginas HTML redirecionam para login
    """
    rotas_livres = ['/login', '/api/login']

    if request.path.startswith('/static/'):
        return

    if request.path in rotas_livres:
        return

    if request.path.startswith('/api/') and 'user_id' not in session:
        return jsonify({"error": "Não autorizado"}), 401

    if 'user_id' not in session:
        return redirect(url_for('login'))


@app.after_request
def add_header(response):
    """Evita cache em páginas protegidas"""
    response.headers['Cache-Control'] = 'no-store'
    return response


# ======================================================
# AUDITORIA
# ======================================================
def registrar_auditoria(acao, usuario_afetado):
    """
    Registra CREATE / UPDATE / DELETE de usuários
    """
    try:
        conn = get_db_connection()
        conn.execute(
            '''
            INSERT INTO auditoria_usuarios
            (acao, usuario_afetado, executado_por)
            VALUES (?, ?, ?)
            ''',
            (acao, usuario_afetado, session.get('user_nome'))
        )
        conn.commit()
        conn.close()
    except Exception as e:
        print("Erro auditoria:", e)


# ======================================================
# ROTAS DE TELAS
# ======================================================
@app.route('/')
@app.route('/login')
def login():
    return render_template('Login.html')


@app.route('/dashboard')
def dashboard():
    return render_template('index.html')


@app.route('/perfil')
def perfil():
    return render_template('perfil.html')


@app.route('/relatorios')
def relatorios():
    return render_template('Relatorio.html')


@app.route('/usuarios')
def usuarios():
    if session.get('user_nivel') != 'Administrador':
        return redirect(url_for('dashboard'))
    return render_template('Usuarios.html')


@app.route('/auditoria')
def auditoria():
    if session.get('user_nivel') != 'Administrador':
        return redirect(url_for('dashboard'))
    return render_template('Auditoria.html')


@app.route('/api/logout')
def logout():
    session.clear()
    return redirect(url_for('login'))


# ======================================================
# AUTENTICAÇÃO
# ======================================================
@app.route('/api/login', methods=['POST'])
def api_login():
    dados = request.json
    user = dados.get('username')
    senha = dados.get('password')

    conn = get_db_connection()
    u = conn.execute(
        '''
        SELECT * FROM usuarios
        WHERE (email = ? OR matricula = ?) AND senha = ?
        ''',
        (user, user, senha)
    ).fetchone()
    conn.close()

    if not u:
        return jsonify({"success": False}), 401

    session['user_id'] = u['id']
    session['user_nome'] = u['nome']
    session['user_nivel'] = u['nivel_acesso']
    session.permanent = True

    return jsonify({"success": True, "redirect": "/dashboard"})


# ======================================================
# PONTO ELETRÔNICO
# ======================================================
@app.route('/api/ponto', methods=['POST'])
def registrar_ponto():
    """
    Registra entrada/saída com localização
    """
    try:
        dados = request.json or {}
        tipo = dados.get('tipo')
        local = dados.get('localizacao') or {}

        lat = local.get('latitude')
        lon = local.get('longitude')
        endereco = None

        if lat and lon:
            dist = calcular_distancia(lat, lon, EMPRESA_LAT, EMPRESA_LON)
            endereco = "Escritório" if dist <= RAIO_METROS else obter_endereco(lat, lon)

        conn = get_db_connection()
        conn.execute(
            '''
            INSERT INTO registros_ponto
            (usuario_id, tipo, latitude, longitude, ip, user_agent, endereco)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ''',
            (
                session['user_id'],
                tipo,
                lat,
                lon,
                request.remote_addr,
                request.headers.get('User-Agent'),
                endereco
            )
        )
        conn.commit()
        conn.close()

        return jsonify({"success": True})

    except Exception as e:
        print("ERRO AO REGISTRAR PONTO:", e)
        return jsonify({"error": "Erro interno"}), 500


@app.route('/api/ponto', methods=['GET'])
def listar_pontos():
    """
    Últimos registros (Dashboard)
    """
    conn = get_db_connection()
    rows = conn.execute(
        '''
        SELECT tipo, horario, endereco
        FROM registros_ponto
        WHERE usuario_id = ?
        ORDER BY horario DESC
        LIMIT 5
        ''',
        (session['user_id'],)
    ).fetchall()
    conn.close()

    return jsonify([
        {
            "tipo": r["tipo"],
            "horario": r["horario"],
            "localizacao": r["endereco"] or "Não informado"
        } for r in rows
    ])


@app.route('/api/ponto/historico')
def historico_ponto():
    """
    Histórico completo (Perfil)
    """
    conn = get_db_connection()
    rows = conn.execute(
        '''
        SELECT tipo, horario, endereco
        FROM registros_ponto
        WHERE usuario_id = ?
        ORDER BY horario DESC
        ''',
        (session['user_id'],)
    ).fetchall()
    conn.close()

    return jsonify([
        {
            "tipo": r["tipo"],
            "horario": r["horario"],
            "localizacao": r["endereco"] or "Não informado"
        } for r in rows
    ])


# ======================================================
# USUÁRIOS + AUDITORIA
# ======================================================
@app.route('/api/usuarios', methods=['GET'])
def listar_usuarios():
    if session.get('user_nivel') != 'Administrador':
        return jsonify({"error": "Acesso negado"}), 403

    conn = get_db_connection()
    rows = conn.execute('SELECT * FROM usuarios').fetchall()
    conn.close()

    return jsonify([dict(r) for r in rows])


@app.route('/api/usuarios', methods=['POST'])
def criar_usuario():
    dados = request.json

    conn = get_db_connection()
    conn.execute(
        '''
        INSERT INTO usuarios
        (nome, email, departamento, cargo, unidade, nivel_acesso, senha, matricula, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''',
        (
            dados['nome'],
            dados['email'],
            dados['departamento'],
            dados['cargo'],
            dados['unidade'],
            dados['nivel_acesso'],
            dados['senha'],
            dados['matricula'],
            dados.get('status', 'Ativo')
        )
    )
    conn.commit()
    conn.close()

    registrar_auditoria('CREATE', dados['nome'])
    return jsonify({"success": True})


@app.route('/api/usuarios/<int:user_id>', methods=['PUT'])
def editar_usuario(user_id):
    dados = request.json

    conn = get_db_connection()
    usuario = conn.execute(
        'SELECT nome FROM usuarios WHERE id = ?', (user_id,)
    ).fetchone()

    conn.execute(
        '''
        UPDATE usuarios
        SET nome=?, email=?, departamento=?, cargo=?, unidade=?,
            nivel_acesso=?, status=?
        WHERE id=?
        ''',
        (
            dados['nome'],
            dados['email'],
            dados['departamento'],
            dados['cargo'],
            dados['unidade'],
            dados['nivel_acesso'],
            dados['status'],
            user_id
        )
    )
    conn.commit()
    conn.close()

    if usuario:
        registrar_auditoria('UPDATE', usuario['nome'])

    return jsonify({"success": True})


@app.route('/api/usuarios/<int:user_id>', methods=['DELETE'])
def excluir_usuario(user_id):
    conn = get_db_connection()
    usuario = conn.execute(
        'SELECT nome FROM usuarios WHERE id = ?', (user_id,)
    ).fetchone()

    conn.execute('DELETE FROM usuarios WHERE id = ?', (user_id,))
    conn.commit()
    conn.close()

    if usuario:
        registrar_auditoria('DELETE', usuario['nome'])

    return jsonify({"success": True})


# ======================================================
# AUDITORIA – API
# ======================================================
@app.route('/api/auditoria')
def listar_auditoria():
    conn = get_db_connection()
    rows = conn.execute(
        '''
        SELECT acao, usuario_afetado, executado_por, data
        FROM auditoria_usuarios
        ORDER BY data DESC
        '''
    ).fetchall()
    conn.close()

    return jsonify([dict(r) for r in rows])


# ======================================================
# START
# ======================================================
if __name__ == '__main__':
    app.run(debug=True)
