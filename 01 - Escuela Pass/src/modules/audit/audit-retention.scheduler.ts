/*
Escuela Pass — Proprietary Software License
Copyright (c) 2026 Murillo Martínez Jhon Kevin. All Rights Reserved.

NOTICE: This software and associated documentation files (the "Software")
constitute proprietary intellectual property. Unauthorized use is prohibited.

1. GRANT OF RIGHTS
   No license is granted to any person or entity except as expressly set
   forth in a separate written agreement signed by the copyright holder.

2. RESTRICTIONS
   Without prior written permission from the copyright holder, you may NOT:
   (a) copy, modify, adapt, translate, or create derivative works of the Software;
   (b) reverse engineer, decompile, or disassemble the Software, except as
       permitted by applicable law;
   (c) distribute, sublicense, lease, rent, sell, or otherwise transfer the
       Software or any portion thereof;
   (d) use the Software for commercial purposes, including offering it as a
       hosted service to third parties;
   (e) remove or alter any proprietary notices, labels, or marks.

3. THIRD-PARTY COMPONENTS
   The Software may include or depend on third-party open-source components
   licensed under their own terms (see package manifests and NOTICE files).
   Those components remain governed by their respective licenses. This license
   applies only to the original work of the copyright holder.

4. ACADEMIC REPOSITORY (POLI JIC)
   A non-exclusive, royalty-free, limited license is granted to Politécnico
   Colombiano Jaime Isaza Cadavid solely to archive, reproduce, and make
   available the version of the Software submitted as part of the author's
   degree thesis for academic, educational, and non-commercial public
   consultation purposes, in accordance with institutional publication
   authorization. This does not grant commercial exploitation rights to
   the institution or to third parties.

5. NO WARRANTY
   THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
   IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY,
   FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT. IN NO EVENT SHALL
   THE COPYRIGHT HOLDER BE LIABLE FOR ANY CLAIM, DAMAGES, OR OTHER LIABILITY.

6. GOVERNING LAW
   This license shall be governed by the laws of the Republic of Colombia,
   without regard to conflict-of-law principles.

7. CONTACT
   For licensing inquiries: jhonkevinmurillom@gmail.com

---

Resumen en español:
Software propietario de Murillo Martínez Jhon Kevin (2026). Queda prohibida la
copia, modificación, distribución o explotación comercial sin autorización
escrita. El POLI JIC cuenta con autorización limitada, no exclusiva y sin
fines de lucro, para archivo y consulta académica de la versión entregada
como Trabajo de Grado. Los componentes de terceros se rigen por sus propias
licencias.
*/

import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { getAppTimeZone } from '../../common/local-date';
import { AuditLogEntity } from '../../database/entities/audit-log.entity';

/**
 * Retención de la bitácora de auditoría. LFPDPPP recomienda un plazo razonable
 * y proporcional al fin de tratamiento; 24 meses cubre auditorías escolares
 * típicas (un ciclo escolar + un año fiscal completo) sin acumular PII
 * indefinidamente. Configurable vía `AUDIT_RETENTION_MONTHS`.
 *
 * Se ejecuta una vez al día a las 03:30 en APP_TIMEZONE para minimizar
 * impacto en horarios institucionales activos.
 */
@Injectable()
export class AuditRetentionScheduler {
  private readonly logger = new Logger(AuditRetentionScheduler.name);

  constructor(
    @InjectRepository(AuditLogEntity)
    private readonly auditRepository: Repository<AuditLogEntity>
  ) {}

  @Cron('30 3 * * *', { timeZone: getAppTimeZone() })
  async pruneOldEntries(): Promise<void> {
    const months = this.retentionMonths();
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - months);
    try {
      const result = await this.auditRepository.delete({
        createdAt: LessThan(cutoff)
      });
      const affected = result.affected ?? 0;
      if (affected > 0) {
        this.logger.log(
          `Auditoría: purgadas ${affected} entradas previas a ${cutoff.toISOString()} (retención ${months} meses).`
        );
      }
    } catch (err) {
      this.logger.error('No se pudo purgar audit_logs por retención', err as Error);
    }
  }

  private retentionMonths(): number {
    const raw = Number.parseInt(process.env.AUDIT_RETENTION_MONTHS ?? '24', 10);
    if (Number.isFinite(raw) && raw >= 1 && raw <= 240) return raw;
    return 24;
  }
}
