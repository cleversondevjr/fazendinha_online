import os
import psycopg2
from dotenv import load_dotenv

def check_db():
    load_dotenv(dotenv_path='server/.env')

    host = os.getenv('PGHOST', 'localhost')
    user = os.getenv('PGUSER', 'postgres')
    password = os.getenv('PGPASSWORD', '')
    database = os.getenv('PGDATABASE', 'farm')
    port = os.getenv('PGPORT', '5432')

    print(f"--- Iniciando Diagnóstico da Fazendinha Online ---")
    print(f"Conectando ao banco: {database} em {host}:{port}...")

    try:
        conn = psycopg2.connect(
            host=host,
            user=user,
            password=password,
            dbname=database,
            port=port
        )
        cur = conn.cursor()
        print("[OK] Conexão estabelecida com sucesso.")

        # Check tables
        tables = [
            'fazenda_plantacoes',
            'fazenda_inventario',
            'fazenda_config',
            'fazenda_missoes_template',
            'fazenda_missoes_jogador',
            'fazenda_itens_config'
        ]

        for table in tables:
            cur.execute(f"SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = '{table}');")
            exists = cur.fetchone()[0]
            status = "[OK]" if exists else "[ERRO]"
            print(f"{status} Tabela '{table}' encontrada.")

        # Check Migration 004 columns
        print("\nVerificando Migração 004 (Lógica de Pausa):")
        columns_to_check = ['total_paused_ms', 'pause_started_at', 'pot_expires_at', 'water_expires_at']
        for col in columns_to_check:
            cur.execute(f"SELECT EXISTS (SELECT FROM information_schema.columns WHERE table_name='fazenda_plantacoes' AND column_name='{col}');")
            exists = cur.fetchone()[0]
            status = "[OK]" if exists else "[ERRO]"
            print(f"{status} Coluna '{col}' em fazenda_plantacoes.")

        # Check Mission Templates
        cur.execute("SELECT count(*) FROM fazenda_missoes_template;")
        mission_count = cur.fetchone()[0]
        print(f"\n[INFO] {mission_count} modelos de missões encontrados.")

        cur.close()
        conn.close()
        print("\n--- Diagnóstico Concluído ---")

    except Exception as e:
        print(f"\n[FALHA CRÍTICA] Erro ao conectar ou diagnosticar: {e}")

if __name__ == "__main__":
    check_db()
