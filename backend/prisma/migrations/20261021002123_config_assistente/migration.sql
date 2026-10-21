-- CreateTable
CREATE TABLE `config_assistente` (
    `id` VARCHAR(20) NOT NULL DEFAULT 'padrao',
    `provedor` VARCHAR(191) NOT NULL DEFAULT 'anthropic',
    `ativo` BOOLEAN NOT NULL DEFAULT true,
    `instrucoes_extras` TEXT NULL,
    `provedores` JSON NOT NULL,
    `atualizado_por_id` VARCHAR(36) NULL,
    `atualizado_em` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
