import sqlite3
import os

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
DATABASE = os.path.join(BASE_DIR, 'db_teste.sqlite')

def get_db_connection():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS departamentos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT UNIQUE NOT NULL
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS cargos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT UNIQUE NOT NULL
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS usuarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            departamento TEXT,
            cargo TEXT,
            nivel_acesso TEXT,
            senha TEXT NOT NULL,
            matricula TEXT UNIQUE NOT NULL,
            status TEXT DEFAULT 'Ativo',
            data_cadastro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    cursor.execute('SELECT COUNT(*) FROM departamentos')
    if cursor.fetchone()[0] == 0:
        deps = [('TI',), ('RH',), ('Financeiro',), ('Faturamento',), ('Tecnica',), ('Logistica',), ('Comercial',), ('SAC',), ('Marketing',), ('Casa Canon',)]
        cursor.executemany('INSERT INTO departamentos (nome) VALUES (?)', deps)
        print(f"{len(deps)} departamentos inseridos.")

    cursor.execute('SELECT COUNT(*) FROM cargos')
    if cursor.fetchone()[0] == 0:
        lista_cargos = [('Estagiário(a)',), ('Analista',), ('Coordenador(a)',), ('Supervisor(a)',), ('Gerente',), ('Diretor(a)',)]
        cursor.executemany('INSERT INTO cargos (nome) VALUES (?)', lista_cargos)

    conn.commit()
    conn.close()

if __name__ == '__main__':
    init_db()