-- AlterTable
ALTER TABLE `importacoes_planilha` ADD COLUMN `cod_convenio` VARCHAR(191) NULL,
    ADD COLUMN `convenio` VARCHAR(191) NULL,
    ADD COLUMN `criador_id` VARCHAR(36) NULL,
    ADD COLUMN `duplicados` INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `leads_importados` ADD COLUMN `dados` JSON NULL;

-- CreateIndex
CREATE INDEX `leads_importados_dono_id_cpf_cod_convenio_idx` ON `leads_importados`(`dono_id`, `cpf`, `cod_convenio`);
