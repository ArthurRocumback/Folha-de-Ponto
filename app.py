from flask import Flask, render_template, jsonify, request
import sqlite3

app = Flask(__name__, template_folder='templates', static_folder='static')
DATABASE = 'db_teste.sqlite'

def get_db_connection():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn

# ===== ROTAS DE TELAS =====

@app.route('/')
@app.route('/login')
def login():
    return render_template('index.html')

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
    return render_template('Usuarios.html')

# ===== APIs DE USUÁRIOS =====

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
            '''
            INSERT INTO usuarios (nome, email, departamento, cargo, nivel_acesso, senha, matricula)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ''',
            (dados['nome'], dados['email'], dados['departamento'], dados['cargo'], dados['nivel_acesso'], dados['senha'], dados['matricula'])
        )
        conn.commit()
        return jsonify({"message": "Usuário criado com sucesso"}), 201
    except sqlite3.IntegrityError:
        return jsonify({"error": "E-mail ou Matrícula já cadastrados"}), 400
    finally:
        conn.close()

# ROTA DE EDIÇÃO (FALTAVA ESTA)
@app.route('/api/usuarios/<int:id>', methods=['PUT'])
def editar_usuario(id):
    dados = request.json
    conn = get_db_connection()
    try:
        # Se a senha vier vazia, não atualizamos ela para não sobrescrever com vazio
        if dados.get('senha'):
            conn.execute(
                '''
                UPDATE usuarios 
                SET nome=?, email=?, departamento=?, cargo=?, nivel_acesso=?, senha=?, matricula=?
                WHERE id=?
                ''',
                (dados['nome'], dados['email'], dados['departamento'], dados['cargo'], dados['nivel_acesso'], dados['senha'], dados['matricula'], id)
            )
        else:
            conn.execute(
                '''
                UPDATE usuarios 
                SET nome=?, email=?, departamento=?, cargo=?, nivel_acesso=?, matricula=?
                WHERE id=?
                ''',
                (dados['nome'], dados['email'], dados['departamento'], dados['cargo'], dados['nivel_acesso'], dados['matricula'], id)
            )
        conn.commit()
        return jsonify({"message": "Usuário atualizado com sucesso"})
    except Exception as e:
        return jsonify({"error": str(e)}), 400
    finally:
        conn.close()

# ROTA DE EXCLUSÃO (FALTAVA ESTA)
@app.route('/api/usuarios/<int:id>', methods=['DELETE'])
def excluir_usuario(id):
    conn = get_db_connection()
    try:
        conn.execute('DELETE FROM usuarios WHERE id = ?', (id,))
        conn.commit()
        return jsonify({"message": "Usuário excluído com sucesso"})
    except Exception as e:
        return jsonify({"error": str(e)}), 400
    finally:
        conn.close()

if __name__ == '__main__':
    app.run(debug=True)