# Bill Burger — site + painel administrativo

## Estrutura
- `index.html`: site público, cardápio, avaliações e janela de login.
- `admin.js`: integração com Supabase, renderização do cardápio e painel.
- `supabase-config.js`: URL e chave pública (publishable/anon) do projeto.
- `supabase-schema.sql`: tabelas, função de autorização e políticas RLS.
- `assets/`: imagens originais do cardápio.

## 1. Configurar o banco
1. Abra o projeto `cpvudjobslnxmrmeqsze` no Supabase.
2. Entre em **SQL Editor > New query**.
3. Cole e execute todo o arquivo `supabase-schema.sql`.

## 2. Criar o administrador
1. Em **Authentication > Users**, crie o usuário com e-mail e senha.
2. Copie o UUID desse usuário.
3. Execute no SQL Editor, substituindo o UUID:
   ```sql
   insert into public.admin_users (user_id)
   values ('UUID-DO-USUARIO');
   ```
4. Desative novos cadastros públicos em Authentication > Sign In / Providers, se não precisar deles.

O usuário precisa estar na tabela `admin_users`. Criar um usuário no Auth, sozinho, não concede acesso administrativo.

## 3. Configuração pública
`supabase-config.js` já contém a URL e a chave `sb_publishable_...` fornecidas no material original. Ela é uma chave pública e pode ficar no navegador desde que as políticas RLS estejam ativas. **Nunca coloque `service_role` ou uma secret key nesse arquivo.**

Se a chave pública for rotacionada, substitua o valor em `SUPABASE_ANON_KEY`.

## 4. Publicar no Netlify
1. Extraia o ZIP.
2. Arraste a pasta `bill-burger-site` para o deploy manual do Netlify, ou conecte o repositório Git.
3. Para site estático, use:
   - Build command: vazio
   - Publish directory: `.`
4. Confirme que `index.html`, `admin.js`, `supabase-config.js`, `supabase-schema.sql` e a pasta `assets` estão na raiz publicada.
5. Abra a URL do site e teste menu, envio de avaliação e login administrativo.

O arquivo `netlify.toml` já define a publicação da raiz sem etapa de build.

## 5. Usar o painel
No rodapé, clique em **Área administrativa** e entre com o e-mail/senha criados no Supabase.
- Edite nome, descrição e preço de produtos.
- Para vários preços, separe com `|`. Exemplo: `P: R$ 13 | M: R$ 18 | G: R$ 23`.
- Altere WhatsApp, Instagram e endereço.
- Exporte backup JSON ou restaure os itens originais.

## Observações
- O site mostra o cardápio original localmente se a tabela `menu_items` estiver vazia. O primeiro administrador que entrar inicializa a tabela com os itens presentes no HTML.
- Os preços do cardápio foram preservados conforme as imagens enviadas. Confirme os valores com a loja antes de divulgar.
- As avaliações são públicas e não verificam compra. Para reduzir spam em produção, considere CAPTCHA/Turnstile e limitação de frequência.
- O SQL também migra a regra antiga de avaliações: novas avaliações devem ter de 1 a 5 estrelas. A constraint é criada como `NOT VALID` para preservar registros antigos, caso exista algum com nota zero. Se tiver certeza de que não há notas antigas inválidas, valide depois com `alter table public.reviews validate constraint reviews_rating_range;`.


## SEO e Google
Consulte `SEO-INSTRUCOES.txt`. O projeto inclui `robots.txt`, `sitemap.xml`, `favicon.svg`, metadados sociais e dados estruturados. Após publicar, envie `sitemap.xml` no Google Search Console.
