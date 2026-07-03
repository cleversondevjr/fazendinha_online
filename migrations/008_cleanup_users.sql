-- Migração 008: Limpeza de Usuários
-- Mantém apenas o usuário CleversonS como ID 1 para resetar o ambiente

-- Primeiro, deletamos todos os usuários exceto o CleversonS
DELETE FROM fazenda_usuarios WHERE login != 'CleversonS';

-- Agora garantimos que o CleversonS tenha o ID 1
UPDATE fazenda_usuarios SET id = 1 WHERE login = 'CleversonS';

-- Reinicia a sequência do ID para evitar conflitos futuros
SELECT setval('fazenda_usuarios_id_seq', 1);
