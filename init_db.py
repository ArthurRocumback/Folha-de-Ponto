import sqlite3
import os

# Caminho base do projeto
BASE_DIR = os.path.abspath(os.path.dirname(__file__))
DATABASE = os.path.join(BASE_DIR, 'db_teste.sqlite')

def get_db_connection():
    """Cria conexão com SQLite"""
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """
    Cria todas as tabelas necessárias para o sistema.
    Pode ser executado várias vezes sem sobrescrever dados.
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    # ===============================
    # TABELAS BÁSICAS
    # ===============================
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS departamentos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT UNIQUE NOT NULL
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS cargos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT UNIQUE NOT NULL
        )
    """)

    # ===============================
    # TABELA DE USUÁRIOS
    # ===============================
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS usuarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            departamento TEXT,
            cargo TEXT,
            unidade TEXT,
            nivel_acesso TEXT,
            senha TEXT NOT NULL,
            matricula TEXT UNIQUE NOT NULL,
            status TEXT DEFAULT 'Ativo',
            data_cadastro TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # ===============================
    # AUDITORIA DE USUÁRIOS (NOVA)
    # ===============================
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS auditoria_usuarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            acao TEXT NOT NULL,
            usuario_afetado_id INTEGER,
            usuario_afetado TEXT NOT NULL,
            executado_por TEXT NOT NULL,
            data TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # ===============================
    # REGISTROS DE PONTO
    # ===============================
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS registros_ponto (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            usuario_id INTEGER NOT NULL,
            tipo TEXT NOT NULL, -- Entrada / Saída
            horario TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

            latitude REAL,
            longitude REAL,
            ip TEXT,
            user_agent TEXT,
            endereco TEXT,

            FOREIGN KEY (usuario_id) REFERENCES usuarios (id)
        );
    """)

    # ===============================
    # DADOS INICIAIS
    # ===============================
    cursor.execute('SELECT COUNT(*) FROM departamentos')
    if cursor.fetchone()[0] == 0:
        deps = [
            ('TI',), ('RH',), ('Financeiro',), ('Faturamento',),
            ('Tecnica',), ('Logistica',), ('Comercial',),
            ('SAC',), ('Marketing',), ('Casa Canon',)
        ]
        cursor.executemany(
            'INSERT INTO departamentos (nome) VALUES (?)', deps
        )

    cursor.execute('SELECT COUNT(*) FROM cargos')
    if cursor.fetchone()[0] == 0:
        cargos = [
            ('Estagiário(a)',), ('Analista',), ('Coordenador(a)',),
            ('Supervisor(a)',), ('Gerente',), ('Diretor(a)',)
        ]
        cursor.executemany(
            'INSERT INTO cargos (nome) VALUES (?)', cargos
        )

    # ===============================
    # USUÁRIO ADMINISTRADOR PADRÃO
    # ===============================
    cursor.execute('SELECT COUNT(*) FROM usuarios')
    total_usuarios = cursor.fetchone()[0]

    if total_usuarios == 0:
        cursor.execute(
            '''
            INSERT INTO usuarios
            (nome, email, departamento, cargo, unidade, nivel_acesso, senha, matricula, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''',
            (
                'adm',
                'adm@local',
                'TI',
                'Administrador',
                'Matriz',
                'Administrador',
                '123',
                'ADM001',
                'Ativo'
            )
        )

        print('Usuário administrador padrão criado (adm / 123)')

    conn.commit()
    conn.close()
    print("Banco de dados inicializado com sucesso!")

if __name__ == '__main__':
    init_db()
