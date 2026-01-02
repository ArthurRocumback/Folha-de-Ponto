from flask import Flask, render_template, jsonify, request
import sqlite3

app = Flask(__name__, template_folder='templates', static_folder='static')
DATABASE = 'db_teste.sqlite'

def get_db_connection():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn

@app.route('/')
def index():
    return render_template('Usuarios.html')

# API para buscar opções do Modal
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

# API para listar utilizadores na tabela
@app.route('/api/usuarios', methods=['GET'])
def listar_usuarios():
    conn = get_db_connection()
    usuarios = conn.execute('SELECT * FROM usuarios ORDER BY id DESC').fetchall()
    conn.close()
    return jsonify([dict(u) for u in usuarios])

# API para salvar novo utilizador
@app.route('/api/usuarios', methods=['POST'])
def add_usuario():
    dados = request.json
    try:
        conn = get_db_connection()
        conn.execute('''
            INSERT INTO usuarios (nome, email, departamento, cargo, nivel_acesso, senha, matricula)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (dados['nome'], dados['email'], dados['departamento'], 
              dados['cargo'], dados['nivel_acesso'], dados['senha'], dados['matricula']))
        conn.commit()
        conn.close()
        return jsonify({"mensagem": "Sucesso"}), 201
    except Exception as e:
        return jsonify({"erro": str(e)}), 400

if __name__ == '__main__':
    app.run(debug=True)

