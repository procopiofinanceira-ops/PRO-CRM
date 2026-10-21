-- CreateTable
CREATE TABLE `usuarios` (
    `id` VARCHAR(36) NOT NULL,
    `perfil` ENUM('MASTER', 'GERENTE', 'SUPERVISOR', 'BKO', 'PROMOTOR') NOT NULL,
    `nome` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `senha_hash` VARCHAR(191) NOT NULL,
    `cargo` VARCHAR(191) NULL,
    `departamento` VARCHAR(191) NULL,
    `telefone` VARCHAR(191) NULL,
    `foto_url` VARCHAR(191) NULL,
    `ativo` BOOLEAN NOT NULL DEFAULT true,
    `ultimo_login` DATETIME(3) NULL,
    `superior_id` VARCHAR(36) NULL,
    `permissoes` JSON NOT NULL,
    `permissao_estrategia` BOOLEAN NOT NULL DEFAULT true,
    `permissao_importacao` BOOLEAN NOT NULL DEFAULT false,
    `supervisores_gerenciados` JSON NOT NULL,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizado_em` DATETIME(3) NOT NULL,

    UNIQUE INDEX `usuarios_email_key`(`email`),
    INDEX `usuarios_superior_id_idx`(`superior_id`),
    INDEX `usuarios_perfil_idx`(`perfil`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `login_otps` (
    `id` VARCHAR(36) NOT NULL,
    `usuario_id` VARCHAR(36) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `codigo_hash` VARCHAR(191) NOT NULL,
    `expira_em` DATETIME(3) NOT NULL,
    `usado` BOOLEAN NOT NULL DEFAULT false,
    `tentativas` INTEGER NOT NULL DEFAULT 0,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `login_otps_email_idx`(`email`),
    INDEX `login_otps_usuario_id_idx`(`usuario_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `controle_acesso` (
    `usuario_id` VARCHAR(36) NOT NULL,
    `sessao_id` VARCHAR(191) NULL,
    `ips` JSON NOT NULL,
    `ultimo_ip` VARCHAR(191) NULL,
    `ultimo_acesso_em` DATETIME(3) NULL,
    `ip_bloqueado` VARCHAR(191) NULL,
    `ip_bloqueado_em` DATETIME(3) NULL,
    `travar_primeiro_login` BOOLEAN NOT NULL DEFAULT false,
    `atualizado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`usuario_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `contatos` (
    `id` VARCHAR(36) NOT NULL,
    `dono_id` VARCHAR(36) NOT NULL,
    `nome` VARCHAR(191) NOT NULL,
    `empresa` VARCHAR(191) NULL,
    `pais` VARCHAR(191) NULL DEFAULT 'Brasil',
    `telefone` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `tipo` ENUM('PESSOA', 'EMPRESA') NOT NULL DEFAULT 'PESSOA',
    `favorito` BOOLEAN NOT NULL DEFAULT false,
    `foto_url` VARCHAR(191) NULL,
    `observacoes` TEXT NULL,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizado_em` DATETIME(3) NOT NULL,

    INDEX `contatos_dono_id_idx`(`dono_id`),
    INDEX `contatos_dono_id_nome_idx`(`dono_id`, `nome`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `oportunidades` (
    `id` VARCHAR(36) NOT NULL,
    `dono_id` VARCHAR(36) NOT NULL,
    `contato_id` VARCHAR(36) NULL,
    `responsavel_id` VARCHAR(36) NULL,
    `nome` VARCHAR(191) NOT NULL,
    `empresa` VARCHAR(191) NULL,
    `valor` DECIMAL(15, 2) NULL,
    `estagio` VARCHAR(191) NOT NULL DEFAULT 'novo',
    `pipeline` VARCHAR(191) NOT NULL DEFAULT 'Meu Pipeline',
    `data_prevista` DATE NULL,
    `prioridade` INTEGER NOT NULL DEFAULT 0,
    `descricao` TEXT NULL,
    `telefone` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `produto` VARCHAR(191) NULL,
    `cidade` VARCHAR(191) NULL,
    `cpf` VARCHAR(191) NULL,
    `motivo_perda` VARCHAR(191) NULL,
    `estagio_atualizado_em` DATETIME(3) NULL,
    `detalhes` JSON NULL,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizado_em` DATETIME(3) NOT NULL,

    INDEX `oportunidades_dono_id_idx`(`dono_id`),
    INDEX `oportunidades_dono_id_estagio_idx`(`dono_id`, `estagio`),
    INDEX `oportunidades_dono_id_pipeline_idx`(`dono_id`, `pipeline`),
    INDEX `oportunidades_responsavel_id_idx`(`responsavel_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `produtos` (
    `id` VARCHAR(36) NOT NULL,
    `dono_id` VARCHAR(36) NOT NULL,
    `nome` VARCHAR(191) NOT NULL,
    `origem` VARCHAR(191) NULL,
    `ddd` VARCHAR(191) NULL,
    `telefone` VARCHAR(191) NULL,
    `qtd_outros_produtos` INTEGER NULL,
    `outros_produtos` TEXT NULL,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizado_em` DATETIME(3) NOT NULL,

    INDEX `produtos_dono_id_idx`(`dono_id`),
    INDEX `produtos_dono_id_origem_idx`(`dono_id`, `origem`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `projetos` (
    `id` VARCHAR(36) NOT NULL,
    `dono_id` VARCHAR(36) NOT NULL,
    `nome` VARCHAR(191) NOT NULL,
    `responsavel` VARCHAR(191) NULL,
    `data_inicio` DATE NULL,
    `data_fim` DATE NULL,
    `equipe` VARCHAR(191) NULL,
    `descricao` TEXT NULL,
    `status` ENUM('EM_ANDAMENTO', 'CONCLUIDO', 'PAUSADO', 'CANCELADO') NOT NULL DEFAULT 'EM_ANDAMENTO',
    `progresso` INTEGER NOT NULL DEFAULT 0,
    `prioridade` ENUM('BAIXA', 'MEDIA', 'ALTA', 'URGENTE') NOT NULL DEFAULT 'MEDIA',
    `categoria` VARCHAR(191) NULL,
    `favorito` BOOLEAN NOT NULL DEFAULT false,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizado_em` DATETIME(3) NOT NULL,

    INDEX `projetos_dono_id_idx`(`dono_id`),
    INDEX `projetos_dono_id_status_idx`(`dono_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tarefas` (
    `id` VARCHAR(36) NOT NULL,
    `projeto_id` VARCHAR(36) NOT NULL,
    `titulo` VARCHAR(191) NOT NULL,
    `descricao` TEXT NULL,
    `status` ENUM('PENDENTE', 'EM_ANDAMENTO', 'CONCLUIDA') NOT NULL DEFAULT 'PENDENTE',
    `responsavel` VARCHAR(191) NULL,
    `data_limite` DATE NULL,
    `ordem` INTEGER NOT NULL DEFAULT 0,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizado_em` DATETIME(3) NOT NULL,

    INDEX `tarefas_projeto_id_idx`(`projeto_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `observacoes` (
    `id` VARCHAR(36) NOT NULL,
    `dono_id` VARCHAR(36) NOT NULL,
    `titulo` VARCHAR(191) NOT NULL,
    `conteudo` TEXT NULL,
    `estagio` ENUM('NOVA', 'ATA_REUNIAO', 'ANOTACAO', 'A_FAZER') NOT NULL DEFAULT 'ANOTACAO',
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizado_em` DATETIME(3) NOT NULL,

    INDEX `observacoes_dono_id_idx`(`dono_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `eventos_calendario` (
    `id` VARCHAR(36) NOT NULL,
    `dono_id` VARCHAR(36) NOT NULL,
    `titulo` VARCHAR(191) NOT NULL,
    `descricao` TEXT NULL,
    `data_inicio` DATETIME(3) NOT NULL,
    `data_fim` DATETIME(3) NOT NULL,
    `dia_inteiro` BOOLEAN NOT NULL DEFAULT false,
    `cor` VARCHAR(191) NOT NULL DEFAULT 'indigo',
    `local` VARCHAR(191) NULL,
    `participante` VARCHAR(191) NULL,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizado_em` DATETIME(3) NOT NULL,

    INDEX `eventos_calendario_dono_id_idx`(`dono_id`),
    INDEX `eventos_calendario_dono_id_data_inicio_data_fim_idx`(`dono_id`, `data_inicio`, `data_fim`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `canais` (
    `id` VARCHAR(36) NOT NULL,
    `dono_id` VARCHAR(36) NOT NULL,
    `nome` VARCHAR(191) NOT NULL,
    `descricao` VARCHAR(191) NULL,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `canais_dono_id_idx`(`dono_id`),
    UNIQUE INDEX `canais_dono_id_nome_key`(`dono_id`, `nome`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `mensagens` (
    `id` VARCHAR(36) NOT NULL,
    `canal_id` VARCHAR(36) NOT NULL,
    `remetente_id` VARCHAR(36) NULL,
    `conteudo` TEXT NOT NULL,
    `lida` BOOLEAN NOT NULL DEFAULT false,
    `favorita` BOOLEAN NOT NULL DEFAULT false,
    `prioridade` ENUM('BAIXA', 'MEDIA', 'ALTA', 'URGENTE') NOT NULL DEFAULT 'MEDIA',
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `mensagens_canal_id_idx`(`canal_id`),
    INDEX `mensagens_canal_id_lida_idx`(`canal_id`, `lida`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notificacoes` (
    `id` VARCHAR(36) NOT NULL,
    `dono_id` VARCHAR(36) NOT NULL,
    `usuario_id` VARCHAR(36) NULL,
    `tipo` VARCHAR(191) NOT NULL,
    `titulo` VARCHAR(191) NOT NULL,
    `mensagem` TEXT NULL,
    `lida` BOOLEAN NOT NULL DEFAULT false,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `notificacoes_dono_id_lida_idx`(`dono_id`, `lida`),
    INDEX `notificacoes_usuario_id_idx`(`usuario_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `email_marketing` (
    `id` VARCHAR(36) NOT NULL,
    `dono_id` VARCHAR(36) NOT NULL,
    `assunto` VARCHAR(191) NOT NULL,
    `responsavel` VARCHAR(191) NULL,
    `lista_correio` VARCHAR(191) NULL,
    `enviados` INTEGER NOT NULL DEFAULT 0,
    `entregue_pct` DECIMAL(5, 2) NULL,
    `aberto_pct` DECIMAL(5, 2) NULL,
    `clicado_pct` DECIMAL(5, 2) NULL,
    `respondido_pct` DECIMAL(5, 2) NULL,
    `situacao` ENUM('RASCUNHO', 'EM_FILA', 'ENVIANDO', 'ENVIADO', 'CANCELADO') NOT NULL DEFAULT 'RASCUNHO',
    `data_envio` DATETIME(3) NULL,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizado_em` DATETIME(3) NOT NULL,

    INDEX `email_marketing_dono_id_idx`(`dono_id`),
    INDEX `email_marketing_dono_id_situacao_idx`(`dono_id`, `situacao`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sms_marketing` (
    `id` VARCHAR(36) NOT NULL,
    `dono_id` VARCHAR(36) NOT NULL,
    `nome` VARCHAR(191) NOT NULL,
    `lista_correio` VARCHAR(191) NULL,
    `enviados` INTEGER NOT NULL DEFAULT 0,
    `entregues` INTEGER NOT NULL DEFAULT 0,
    `aberto_pct` DECIMAL(5, 2) NULL,
    `respondido_pct` DECIMAL(5, 2) NULL,
    `clicado_pct` DECIMAL(5, 2) NULL,
    `situacao` ENUM('RASCUNHO', 'EM_FILA', 'ENVIANDO', 'ENVIADO', 'CANCELADO') NOT NULL DEFAULT 'RASCUNHO',
    `data_inicio` DATE NULL,
    `data_fim` DATE NULL,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizado_em` DATETIME(3) NOT NULL,

    INDEX `sms_marketing_dono_id_idx`(`dono_id`),
    INDEX `sms_marketing_dono_id_situacao_idx`(`dono_id`, `situacao`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `times_ajuda` (
    `id` VARCHAR(36) NOT NULL,
    `dono_id` VARCHAR(36) NOT NULL,
    `nome` VARCHAR(191) NOT NULL,
    `nao_atribuidos` INTEGER NOT NULL DEFAULT 0,
    `nao_atendidos` INTEGER NOT NULL DEFAULT 0,
    `prioridade` INTEGER NOT NULL DEFAULT 0,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizado_em` DATETIME(3) NOT NULL,

    INDEX `times_ajuda_dono_id_idx`(`dono_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `chamados` (
    `id` VARCHAR(36) NOT NULL,
    `dono_id` VARCHAR(36) NOT NULL,
    `time_id` VARCHAR(36) NULL,
    `atribuido_a_id` VARCHAR(36) NULL,
    `titulo` VARCHAR(191) NOT NULL,
    `descricao` TEXT NULL,
    `status` ENUM('NOVO', 'EM_ANDAMENTO', 'AGUARDANDO', 'RESOLVIDO', 'FECHADO') NOT NULL DEFAULT 'NOVO',
    `prioridade` ENUM('BAIXA', 'MEDIA', 'ALTA', 'URGENTE') NOT NULL DEFAULT 'MEDIA',
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizado_em` DATETIME(3) NOT NULL,

    INDEX `chamados_dono_id_idx`(`dono_id`),
    INDEX `chamados_dono_id_status_idx`(`dono_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `convenios` (
    `id` VARCHAR(36) NOT NULL,
    `dono_id` VARCHAR(36) NOT NULL,
    `nome` VARCHAR(191) NOT NULL,
    `descricao` TEXT NULL,
    `ativo` BOOLEAN NOT NULL DEFAULT true,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizado_em` DATETIME(3) NOT NULL,

    INDEX `convenios_dono_id_idx`(`dono_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `convenios_controle` (
    `id` VARCHAR(36) NOT NULL,
    `dono_id` VARCHAR(36) NOT NULL,
    `tipo` VARCHAR(191) NOT NULL DEFAULT 'CADASTRADO',
    `empregador` VARCHAR(191) NOT NULL,
    `codigo` VARCHAR(191) NULL,
    `tipo_margem` VARCHAR(191) NULL,
    `funcionarios` INTEGER NOT NULL DEFAULT 0,
    `nao_reservados` INTEGER NOT NULL DEFAULT 0,
    `reservados` INTEGER NOT NULL DEFAULT 0,
    `perdidos` INTEGER NOT NULL DEFAULT 0,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizado_em` DATETIME(3) NOT NULL,

    INDEX `convenios_controle_dono_id_tipo_idx`(`dono_id`, `tipo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `convenios_completos` (
    `id` VARCHAR(36) NOT NULL,
    `dono_id` VARCHAR(36) NOT NULL,
    `nome` VARCHAR(191) NOT NULL,
    `cnpj` VARCHAR(191) NULL,
    `codigo` VARCHAR(191) NULL,
    `detalhes` JSON NULL,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizado_em` DATETIME(3) NOT NULL,

    INDEX `convenios_completos_dono_id_idx`(`dono_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `inconsistencias` (
    `id` VARCHAR(36) NOT NULL,
    `dono_id` VARCHAR(36) NOT NULL,
    `parceiro` VARCHAR(191) NOT NULL,
    `codigo_convenio` VARCHAR(191) NOT NULL,
    `resolvido` BOOLEAN NOT NULL DEFAULT false,
    `data_registro` DATETIME(3) NULL,
    `observacao` TEXT NULL,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizado_em` DATETIME(3) NOT NULL,

    INDEX `inconsistencias_dono_id_idx`(`dono_id`),
    INDEX `inconsistencias_dono_id_resolvido_idx`(`dono_id`, `resolvido`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `margens_consignado` (
    `id` VARCHAR(36) NOT NULL,
    `dono_id` VARCHAR(36) NOT NULL,
    `origem` VARCHAR(191) NULL,
    `nome` VARCHAR(191) NOT NULL,
    `ddd` VARCHAR(191) NULL,
    `telefone` VARCHAR(191) NULL,
    `margem_livre` DECIMAL(15, 2) NULL,
    `status` VARCHAR(191) NULL,
    `observacao` TEXT NULL,
    `mensagem_banco` TEXT NULL,
    `tags` JSON NOT NULL,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizado_em` DATETIME(3) NOT NULL,

    INDEX `margens_consignado_dono_id_idx`(`dono_id`),
    INDEX `margens_consignado_dono_id_origem_idx`(`dono_id`, `origem`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `margens_solicitacao` (
    `id` VARCHAR(36) NOT NULL,
    `dono_id` VARCHAR(36) NOT NULL,
    `nome` VARCHAR(191) NULL,
    `cpf` VARCHAR(191) NULL,
    `telefone` VARCHAR(191) NULL,
    `margem_livre` DECIMAL(15, 2) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'pendente',
    `observacao` TEXT NULL,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizado_em` DATETIME(3) NOT NULL,

    INDEX `margens_solicitacao_dono_id_idx`(`dono_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `simulacoes` (
    `id` VARCHAR(36) NOT NULL,
    `dono_id` VARCHAR(36) NOT NULL,
    `convenio` VARCHAR(191) NULL,
    `cod_empresa` VARCHAR(191) NULL,
    `cpf` VARCHAR(191) NULL,
    `cpf_cliente` VARCHAR(191) NULL,
    `margem_livre` DECIMAL(15, 2) NULL,
    `nome` VARCHAR(191) NULL,
    `ddd` VARCHAR(191) NULL,
    `telefone` VARCHAR(191) NULL,
    `status` VARCHAR(191) NULL,
    `observacao` TEXT NULL,
    `qtd_contratos_refin` INTEGER NULL,
    `contratos_refin` TEXT NULL,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizado_em` DATETIME(3) NOT NULL,

    INDEX `simulacoes_dono_id_idx`(`dono_id`),
    INDEX `simulacoes_dono_id_status_idx`(`dono_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `dividas` (
    `id` VARCHAR(36) NOT NULL,
    `dono_id` VARCHAR(36) NOT NULL,
    `empregador` VARCHAR(191) NOT NULL,
    `divida_total` DECIMAL(15, 2) NULL,
    `taxa_simulacao` DECIMAL(10, 4) NULL,
    `saldo_clean` DECIMAL(15, 2) NULL,
    `cartao_credito` DECIMAL(15, 2) NULL,
    `credito_pessoal` DECIMAL(15, 2) NULL,
    `credito_consignado` DECIMAL(15, 2) NULL,
    `atraso` DECIMAL(15, 2) NULL,
    `limite_em_conta` DECIMAL(15, 2) NULL,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizado_em` DATETIME(3) NOT NULL,

    INDEX `dividas_dono_id_idx`(`dono_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `clientes_carteira` (
    `id` VARCHAR(36) NOT NULL,
    `dono_id` VARCHAR(36) NOT NULL,
    `cpf` VARCHAR(191) NOT NULL,
    `cpf_cliente` VARCHAR(191) NULL,
    `convenio` VARCHAR(191) NULL,
    `cod_empresa` VARCHAR(191) NULL,
    `nome` VARCHAR(191) NULL,
    `telefone` VARCHAR(191) NULL,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizado_em` DATETIME(3) NOT NULL,

    INDEX `clientes_carteira_dono_id_idx`(`dono_id`),
    INDEX `clientes_carteira_dono_id_cpf_idx`(`dono_id`, `cpf`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `importacoes_planilha` (
    `id` VARCHAR(36) NOT NULL,
    `dono_id` VARCHAR(36) NOT NULL,
    `arquivo` VARCHAR(191) NOT NULL,
    `total_linhas` INTEGER NOT NULL DEFAULT 0,
    `status` ENUM('PENDENTE', 'IMPORTADO', 'ERRO') NOT NULL DEFAULT 'PENDENTE',
    `origem` VARCHAR(191) NULL,
    `data_importacao` DATETIME(3) NULL,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizado_em` DATETIME(3) NOT NULL,

    INDEX `importacoes_planilha_dono_id_idx`(`dono_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `leads_importados` (
    `id` VARCHAR(36) NOT NULL,
    `dono_id` VARCHAR(36) NULL,
    `importacao_id` VARCHAR(36) NULL,
    `funcionario_id` VARCHAR(36) NULL,
    `cpf` VARCHAR(191) NULL,
    `nome` VARCHAR(191) NULL,
    `telefone` VARCHAR(191) NULL,
    `matricula` VARCHAR(191) NULL,
    `convenio` VARCHAR(191) NULL,
    `cod_convenio` VARCHAR(191) NULL,
    `margem` VARCHAR(191) NULL,
    `margem_menor` VARCHAR(191) NULL,
    `status_lead` VARCHAR(191) NOT NULL DEFAULT 'novo',
    `observacao` TEXT NULL,
    `qtd_contratos` VARCHAR(191) NULL,
    `contratos` TEXT NULL,
    `qtd_outros_produtos` VARCHAR(191) NULL,
    `outros_produtos` TEXT NULL,
    `origem` VARCHAR(191) NULL,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizado_em` DATETIME(3) NOT NULL,

    INDEX `leads_importados_dono_id_idx`(`dono_id`),
    INDEX `leads_importados_importacao_id_idx`(`importacao_id`),
    INDEX `leads_importados_funcionario_id_idx`(`funcionario_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `leads_supervisor` (
    `id` VARCHAR(36) NOT NULL,
    `dono_id` VARCHAR(36) NOT NULL,
    `funcionario_id` VARCHAR(36) NULL,
    `origem` VARCHAR(191) NULL,
    `cpf` VARCHAR(191) NULL,
    `nome` VARCHAR(191) NULL,
    `telefone` VARCHAR(191) NULL,
    `convenio` VARCHAR(191) NULL,
    `convenio_codigo` VARCHAR(191) NULL,
    `resultado` VARCHAR(191) NULL,
    `margem` VARCHAR(191) NULL,
    `observacao` TEXT NULL,
    `status_lead` VARCHAR(191) NOT NULL DEFAULT 'novo',
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizado_em` DATETIME(3) NOT NULL,

    INDEX `leads_supervisor_dono_id_idx`(`dono_id`),
    INDEX `leads_supervisor_dono_id_funcionario_id_idx`(`dono_id`, `funcionario_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `leads_favoritos` (
    `id` VARCHAR(36) NOT NULL,
    `dono_id` VARCHAR(36) NOT NULL,
    `usuario_id` VARCHAR(36) NULL,
    `tipo` VARCHAR(191) NOT NULL DEFAULT 'gestao',
    `nome` VARCHAR(191) NOT NULL,
    `filtros` JSON NOT NULL,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizado_em` DATETIME(3) NOT NULL,

    INDEX `leads_favoritos_dono_id_tipo_idx`(`dono_id`, `tipo`),
    INDEX `leads_favoritos_dono_id_usuario_id_idx`(`dono_id`, `usuario_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `campanhas_supervisor` (
    `id` VARCHAR(36) NOT NULL,
    `dono_id` VARCHAR(36) NOT NULL,
    `nome` VARCHAR(191) NOT NULL,
    `convenios` JSON NOT NULL,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizado_em` DATETIME(3) NOT NULL,

    INDEX `campanhas_supervisor_dono_id_idx`(`dono_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `campanha_supervisor_clientes` (
    `id` VARCHAR(36) NOT NULL,
    `dono_id` VARCHAR(36) NOT NULL,
    `campanha_id` VARCHAR(36) NOT NULL,
    `lead_id` VARCHAR(36) NULL,
    `convenio` VARCHAR(191) NOT NULL,
    `cpf` VARCHAR(191) NULL,
    `matricula` VARCHAR(191) NULL,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `campanha_supervisor_clientes_dono_id_idx`(`dono_id`),
    INDEX `campanha_supervisor_clientes_campanha_id_idx`(`campanha_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `wa_leads` (
    `id` VARCHAR(36) NOT NULL,
    `dono_id` VARCHAR(36) NOT NULL,
    `telefone` VARCHAR(191) NOT NULL,
    `nome` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'novo',
    `origem` VARCHAR(191) NOT NULL DEFAULT 'disparo',
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizado_em` DATETIME(3) NOT NULL,

    UNIQUE INDEX `wa_leads_dono_id_telefone_key`(`dono_id`, `telefone`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `wa_conversas` (
    `id` VARCHAR(36) NOT NULL,
    `dono_id` VARCHAR(36) NOT NULL,
    `lead_id` VARCHAR(36) NOT NULL,
    `modo` ENUM('IA', 'HUMANO') NOT NULL DEFAULT 'IA',
    `aberta` BOOLEAN NOT NULL DEFAULT true,
    `precisa_atencao` BOOLEAN NOT NULL DEFAULT false,
    `motivo_atencao` VARCHAR(191) NULL,
    `ultima_msg_em` DATETIME(3) NULL,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizado_em` DATETIME(3) NOT NULL,

    UNIQUE INDEX `wa_conversas_lead_id_key`(`lead_id`),
    INDEX `wa_conversas_dono_id_idx`(`dono_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `wa_mensagens` (
    `id` VARCHAR(36) NOT NULL,
    `conversa_id` VARCHAR(36) NOT NULL,
    `remetente` ENUM('LEAD', 'IA', 'HUMANO') NOT NULL,
    `conteudo` TEXT NOT NULL,
    `intencao` VARCHAR(191) NULL,
    `enviada_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `wa_mensagens_conversa_id_idx`(`conversa_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `wa_conhecimento` (
    `id` VARCHAR(36) NOT NULL,
    `dono_id` VARCHAR(36) NOT NULL,
    `titulo` VARCHAR(191) NOT NULL,
    `conteudo` TEXT NOT NULL,
    `ativo` BOOLEAN NOT NULL DEFAULT true,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizado_em` DATETIME(3) NOT NULL,

    INDEX `wa_conhecimento_dono_id_idx`(`dono_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `wa_agente_config` (
    `id` VARCHAR(36) NOT NULL,
    `dono_id` VARCHAR(36) NOT NULL,
    `nome_agente` VARCHAR(191) NOT NULL DEFAULT 'Ana',
    `saudacao` VARCHAR(500) NOT NULL DEFAULT 'Oi, tudo bem? Posso te passar uma informação rápida que pode te ajudar?',
    `prompt_extra` TEXT NULL,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizado_em` DATETIME(3) NOT NULL,

    UNIQUE INDEX `wa_agente_config_dono_id_key`(`dono_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `imob_propostas` (
    `id` VARCHAR(36) NOT NULL,
    `dono_id` VARCHAR(36) NOT NULL,
    `criador_id` VARCHAR(36) NULL,
    `parceiro` VARCHAR(191) NULL,
    `consultor` VARCHAR(191) NULL,
    `data_inicio` DATETIME(3) NULL,
    `portal` VARCHAR(191) NULL,
    `proposta` VARCHAR(191) NULL,
    `aprovacao` VARCHAR(191) NULL,
    `agendamento` DATETIME(3) NULL,
    `documento` VARCHAR(191) NULL,
    `modalidade` VARCHAR(191) NULL,
    `produto` VARCHAR(191) NULL,
    `acao` VARCHAR(191) NULL,
    `etapa` VARCHAR(191) NOT NULL DEFAULT 'Proposta criada',
    `etapa_atualizada_em` DATETIME(3) NULL,
    `observacao1` TEXT NULL,
    `observacao2` TEXT NULL,
    `cliente` VARCHAR(191) NULL,
    `cpf` VARCHAR(191) NULL,
    `contato` VARCHAR(191) NULL,
    `email_cliente` VARCHAR(191) NULL,
    `data_nascimento` DATETIME(3) NULL,
    `cidade` VARCHAR(191) NULL,
    `habitantes` VARCHAR(191) NULL,
    `situacao_profissional` VARCHAR(191) NULL,
    `estado_civil` VARCHAR(191) NULL,
    `renda_principal` VARCHAR(191) NULL,
    `renda_mensal` DECIMAL(15, 2) NULL,
    `renda_familiar` DECIMAL(15, 2) NULL,
    `conjuge_nome` VARCHAR(191) NULL,
    `conjuge_email` VARCHAR(191) NULL,
    `conjuge_celular` VARCHAR(191) NULL,
    `conjuge_cpf` VARCHAR(191) NULL,
    `conjuge_nascimento` DATETIME(3) NULL,
    `conjuge_renda` DECIMAL(15, 2) NULL,
    `valor_imovel` DECIMAL(15, 2) NULL,
    `valor_financiamento_liq` DECIMAL(15, 2) NULL,
    `valor_necessario` DECIMAL(15, 2) NULL,
    `prazo_pretendido` VARCHAR(191) NULL,
    `analise_credito_status` VARCHAR(191) NULL,
    `numero_imovel` VARCHAR(191) NULL,
    `cep_imovel` VARCHAR(191) NULL,
    `complemento_imovel` VARCHAR(191) NULL,
    `tipo_imovel_garantia` VARCHAR(191) NULL,
    `pagando_imovel` VARCHAR(191) NULL,
    `matricula_imovel` VARCHAR(191) NULL,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizado_em` DATETIME(3) NOT NULL,

    INDEX `imob_propostas_dono_id_idx`(`dono_id`),
    INDEX `imob_propostas_criador_id_idx`(`criador_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `imob_proposta_bancos` (
    `id` VARCHAR(36) NOT NULL,
    `proposta_id` VARCHAR(36) NOT NULL,
    `banco` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NULL,
    `valor_aprovado` DECIMAL(15, 2) NULL,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizado_em` DATETIME(3) NOT NULL,

    UNIQUE INDEX `imob_proposta_bancos_proposta_id_banco_key`(`proposta_id`, `banco`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `imob_documentos` (
    `id` VARCHAR(36) NOT NULL,
    `proposta_id` VARCHAR(36) NOT NULL,
    `dono_id` VARCHAR(36) NOT NULL,
    `nome` VARCHAR(191) NOT NULL,
    `nome_original` VARCHAR(191) NOT NULL,
    `mime_type` VARCHAR(191) NULL,
    `tamanho` INTEGER NULL,
    `caminho` VARCHAR(191) NOT NULL,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `imob_documentos_proposta_id_idx`(`proposta_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `imob_simulacoes` (
    `id` VARCHAR(36) NOT NULL,
    `dono_id` VARCHAR(36) NOT NULL,
    `tipo` VARCHAR(191) NOT NULL,
    `criador_nome` VARCHAR(191) NULL,
    `dados` JSON NOT NULL,
    `resultado` JSON NOT NULL,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `imob_simulacoes_dono_id_idx`(`dono_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `integracoes_usuario` (
    `id` VARCHAR(36) NOT NULL,
    `dono_id` VARCHAR(36) NOT NULL,
    `nome` VARCHAR(191) NULL,
    `tipo` VARCHAR(191) NULL,
    `configuracao` JSON NOT NULL,
    `ativo` BOOLEAN NOT NULL DEFAULT true,
    `criado_em` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `atualizado_em` DATETIME(3) NOT NULL,

    INDEX `integracoes_usuario_dono_id_idx`(`dono_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `usuarios` ADD CONSTRAINT `usuarios_superior_id_fkey` FOREIGN KEY (`superior_id`) REFERENCES `usuarios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `oportunidades` ADD CONSTRAINT `oportunidades_contato_id_fkey` FOREIGN KEY (`contato_id`) REFERENCES `contatos`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tarefas` ADD CONSTRAINT `tarefas_projeto_id_fkey` FOREIGN KEY (`projeto_id`) REFERENCES `projetos`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `mensagens` ADD CONSTRAINT `mensagens_canal_id_fkey` FOREIGN KEY (`canal_id`) REFERENCES `canais`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `mensagens` ADD CONSTRAINT `mensagens_remetente_id_fkey` FOREIGN KEY (`remetente_id`) REFERENCES `usuarios`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `chamados` ADD CONSTRAINT `chamados_time_id_fkey` FOREIGN KEY (`time_id`) REFERENCES `times_ajuda`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `leads_importados` ADD CONSTRAINT `leads_importados_importacao_id_fkey` FOREIGN KEY (`importacao_id`) REFERENCES `importacoes_planilha`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `campanha_supervisor_clientes` ADD CONSTRAINT `campanha_supervisor_clientes_campanha_id_fkey` FOREIGN KEY (`campanha_id`) REFERENCES `campanhas_supervisor`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `wa_conversas` ADD CONSTRAINT `wa_conversas_lead_id_fkey` FOREIGN KEY (`lead_id`) REFERENCES `wa_leads`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `wa_mensagens` ADD CONSTRAINT `wa_mensagens_conversa_id_fkey` FOREIGN KEY (`conversa_id`) REFERENCES `wa_conversas`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `imob_proposta_bancos` ADD CONSTRAINT `imob_proposta_bancos_proposta_id_fkey` FOREIGN KEY (`proposta_id`) REFERENCES `imob_propostas`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `imob_documentos` ADD CONSTRAINT `imob_documentos_proposta_id_fkey` FOREIGN KEY (`proposta_id`) REFERENCES `imob_propostas`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
