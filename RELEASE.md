# Release Process

Este documento descreve como fazer releases do Proteus.

## Processo Automatizado (Recomendado)

O Proteus usa GitHub Actions para automatizar releases. Quando você cria uma tag, o workflow:

1. ✅ Faz build do projeto
2. ✅ Extrai as notas de release do CHANGELOG.md
3. ✅ Cria a release no GitHub
4. ✅ Publica no npm

### Passos:

1. **Atualize a versão no package.json**
   ```bash
   # Para bugfix (1.0.1 → 1.0.2)
   npm version patch
   
   # Para nova feature (1.0.2 → 1.1.0)
   npm version minor
   
   # Para breaking change (1.1.0 → 2.0.0)
   npm version major
   ```

2. **Atualize o CHANGELOG.md**
   - Adicione uma nova seção com a versão
   - Descreva as mudanças (Added, Changed, Fixed, etc.)
   - Use o formato:
   ```markdown
   ## [1.0.2] - 2025-01-13
   
   ### Fixed
   - Descrição do bugfix
   
   ### Added
   - Nova funcionalidade
   ```

3. **Commit e push**
   ```bash
   git add .
   git commit -m "chore: release v1.0.2"
   git push
   ```

4. **Crie e push a tag**
   ```bash
   git tag v1.0.2
   git push origin v1.0.2
   ```

5. **Aguarde o workflow**
   - Acesse: https://github.com/nivustec/proteus/actions
   - O workflow "Release" será executado automaticamente
   - Após conclusão, a release estará disponível no GitHub e npm

## Processo Manual (Fallback)

Se o workflow falhar ou você preferir fazer manualmente:

1. **Build**
   ```bash
   npm run build
   ```

2. **Publicar no npm**
   ```bash
   npm publish
   ```

3. **Criar release no GitHub**
   - Vá em: https://github.com/nivustec/proteus/releases/new
   - Escolha a tag criada
   - Copie as notas do CHANGELOG.md
   - Publique

## Configuração Necessária

### Secrets do GitHub

Para o workflow funcionar, você precisa configurar:

1. **NPM_TOKEN** (obrigatório para publicar no npm)
   - Acesse: https://www.npmjs.com/settings/YOUR_USERNAME/tokens
   - Crie um token "Automation"
   - Adicione em: https://github.com/nivustec/proteus/settings/secrets/actions
   - Nome: `NPM_TOKEN`

2. **GITHUB_TOKEN** (já configurado automaticamente)
   - Usado para criar releases
   - Não precisa configurar manualmente

## Versionamento Semântico

Seguimos [Semantic Versioning](https://semver.org/):

- **MAJOR** (X.0.0): Breaking changes
- **MINOR** (0.X.0): Novas features (backward compatible)
- **PATCH** (0.0.X): Bugfixes

### Exemplos:

- `1.0.1 → 1.0.2`: Bugfix
- `1.0.2 → 1.1.0`: Nova feature
- `1.1.0 → 2.0.0`: Breaking change

## Checklist de Release

- [ ] Versão atualizada no package.json
- [ ] CHANGELOG.md atualizado
- [ ] Build passa sem erros (`npm run build`)
- [ ] Commit e push feitos
- [ ] Tag criada e pushed
- [ ] Workflow executado com sucesso
- [ ] Release aparece no GitHub
- [ ] Pacote disponível no npm
- [ ] Testar instalação: `npm install -g @nivustec/proteus@latest`

## Troubleshooting

### Workflow falhou

1. Verifique os logs em: https://github.com/nivustec/proteus/actions
2. Certifique-se que o NPM_TOKEN está configurado
3. Verifique se o CHANGELOG.md está no formato correto

### Publicação no npm falhou

1. Verifique se você está logado: `npm whoami`
2. Verifique permissões do token
3. Tente publicar manualmente: `npm publish`

### Release não aparece no GitHub

1. Verifique se a tag foi pushed: `git push origin v1.0.2`
2. Verifique permissões do GITHUB_TOKEN
3. Crie a release manualmente no GitHub
