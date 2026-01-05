from flask import Flask, render_template, jsonify, request, session, redirect, url_for
import sqlite3
import os
from datetime import timedelta

app = Flask(__name__, template_folder='templates', static_folder='static')

# ==========================================
# CONFIGURAÇÕES DE SEGURANÇA E SESSÃO
# ==========================================
app.secret_key = 'canon_ponto_digital_secret_key' 
app.permanent_session_lifetime = timedelta(hours=24)

DATABASE = 'db_teste.sqlite'

def get_db_connection():
    """ Estabelece conexão com o banco de dados SQLite """
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn

# ==========================================
# CONTROLE DE ACESSO (MIDDLEWARE)
# ==========================================
@app.before_request
def check_session():
    """ Verifica se o utilizador está logado antes de aceder a rotas protegidas """
    allowed_routes = ['login', 'api_login', 'static']
    if request.endpoint not in allowed_routes and 'user_id' not in session:
        return redirect(url_for('login'))

# ==========================================
# ROTAS DE TELAS (PÁGINAS)
# ==========================================
@app.route('/')
@app.route('/login')
def login():
    if 'user_id' in session:
        return redirect(url_for('dashboard'))
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

# ==========================================
# APIs DE AUTENTICAÇÃO
# ==========================================

@app.after_request
def add_header(response):
    response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, post-check=0, pre-check=0, max-age=0'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '-1'
    return response

@app.route('/api/login', methods=['POST'])
def api_login():
    dados = request.json
    username = dados.get('username')
    password = dados.get('password')

    conn = get_db_connection()
    # Procura por matrícula ou email
    user = conn.execute(
        'SELECT * FROM usuarios WHERE (matricula = ? OR email = ?) AND senha = ?',
        (username, username, password)
    ).fetchone()
    conn.close()

    if user:
        session.permanent = True
        session['user_id'] = user['id']
        session['user_nome'] = user['nome']
        session['user_nivel'] = user['nivel_acesso']
        
        return jsonify({
            "success": True, 
            "redirect": url_for('dashboard')
        })
    
    return jsonify({"success": False, "message": "Utilizador ou senha incorretos."}), 401

@app.route('/api/logout')
def logout():
    session.clear()
    return redirect(url_for('login'))

@app.route('/api/ponto', methods=['POST'])
def registrar_ponto():
    if 'user_id' not in session:
        return jsonify({"error": "Não autorizado"}), 401

    dados = request.json
    tipo = dados.get('tipo')  # Entrada ou Saída

    conn = get_db_connection()
    conn.execute(
        '''
        INSERT INTO registros_ponto (usuario_id, tipo)
        VALUES (?, ?)
        ''',
        (session['user_id'], tipo)
    )
    conn.commit()
    conn.close()

    return jsonify({"success": True})

@app.route('/api/ponto', methods=['GET'])
def listar_pontos():
    if 'user_id' not in session:
        return jsonify({"error": "Não autorizado"}), 401

    conn = get_db_connection()
    registros = conn.execute(
        '''
        SELECT tipo, horario
        FROM registros_ponto
        WHERE usuario_id = ?
        ORDER BY horario DESC
        LIMIT 5
        ''',
        (session['user_id'],)
    ).fetchall()
    conn.close()

    return jsonify([dict(r) for r in registros])


# ==========================================
# APIs DE DADOS
# ==========================================
@app.route('/api/perfil', methods=['GET'])
def get_perfil():
    if 'user_id' not in session:
        return jsonify({"error": "Não autorizado"}), 401
    
    conn = get_db_connection()
    user = conn.execute('SELECT * FROM usuarios WHERE id = ?', (session['user_id'],)).fetchone()
    conn.close()
    return jsonify(dict(user))

@app.route('/api/opcoes', methods=['GET'])
def get_opcoes():
    conn = get_db_connection()
    deps = conn.execute('SELECT nome FROM departamentos').fetchall()
    cargos = conn.execute('SELECT nome FROM cargos').fetchall()
    conn.close()
    return jsonify({
        "departamentos": [d['nome'] for d in deps],
        "cargos": [c['nome'] for c in cargos]
    })

@app.route('/api/usuarios', methods=['GET'])
def listar_usuarios():
    if session.get('user_nivel') != 'Administrador':
        return jsonify({"error": "Acesso negado"}), 403
    conn = get_db_connection()
    usuarios = conn.execute('SELECT * FROM usuarios ORDER BY id DESC').fetchall()
    conn.close()
    return jsonify([dict(u) for u in usuarios])

@app.route('/api/usuarios', methods=['POST'])
def add_usuario():
    dados = request.json
    conn = get_db_connection()
    try:
        conn.execute(
            '''INSERT INTO usuarios (nome, email, departamento, cargo, nivel_acesso, senha, matricula)
               VALUES (?, ?, ?, ?, ?, ?, ?)''',
            (dados['nome'], dados['email'], dados['departamento'], dados['cargo'], 
             dados['nivel_acesso'], dados['senha'], dados['matricula'])
        )
        conn.commit()
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 400
    finally:
        conn.close()

if __name__ == '__main__':
    app.run(debug=True)