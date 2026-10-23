-- AlterTable
ALTER TABLE `oportunidades` ADD COLUMN `atividades` JSON NULL,
    ADD COLUMN `data_retorno` DATE NULL,
    ADD COLUMN `hora_retorno` VARCHAR(5) NULL,
    ADD COLUMN `receita_esperada` DECIMAL(15, 2) NULL;

-- CreateIndex
CREATE INDEX `oportunidades_dono_id_data_retorno_idx` ON `oportunidades`(`dono_id`, `data_retorno`);
