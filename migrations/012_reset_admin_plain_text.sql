-- Migration para resetar senhas para texto plano e remover outros usuários (limpeza)
DELETE FROM fazenda_usuarios WHERE id != 1;

-- Garante que o admin principal está em texto plano (o 011 já faz, mas aqui reforçamos a limpeza)
UPDATE fazenda_usuarios SET senha = 'Wincster@194060le' WHERE id = 1;
