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

import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PrivacyPolicyEntity } from '../../database/entities/privacy-policy.entity';
import { UserPrivacyAcceptanceEntity } from '../../database/entities/user-privacy-acceptance.entity';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class PrivacyService {
  constructor(
    @InjectRepository(PrivacyPolicyEntity)
    private readonly policiesRepository: Repository<PrivacyPolicyEntity>,
    @InjectRepository(UserPrivacyAcceptanceEntity)
    private readonly acceptancesRepository: Repository<UserPrivacyAcceptanceEntity>,
    private readonly auditService: AuditService
  ) {}

  async getLatestPolicy() {
    const row = await this.policiesRepository
      .createQueryBuilder('p')
      .orderBy('p.effectiveAt', 'DESC')
      .addOrderBy('p.createdAt', 'DESC')
      .getOne();
    if (!row) throw new NotFoundException('No hay política publicada');
    return {
      id: row.id,
      version: row.version,
      title: row.title,
      content: row.content,
      effectiveAt: row.effectiveAt,
      createdAt: row.createdAt
    };
  }

  async listMyAcceptances(userId: string) {
    const rows = await this.acceptancesRepository.find({
      where: { userId },
      order: { acceptedAt: 'DESC' }
    });
    return rows.map((r) => ({
      userId: r.userId,
      policyVersion: r.policyVersion,
      acceptedAt: r.acceptedAt,
      ipAddress: r.ipAddress != null ? String(r.ipAddress) : null
    }));
  }

  async accept(userId: string, version: string, ip?: string | null) {
    const pol = await this.policiesRepository.findOne({ where: { version } });
    if (!pol) throw new NotFoundException('Versión de política no encontrada');

    const existing = await this.acceptancesRepository.findOne({
      where: { userId, policyVersion: version }
    });
    if (existing) {
      return { message: 'Esta versión ya estaba aceptada', version };
    }

    const row = this.acceptancesRepository.create({
      userId,
      policyVersion: version,
      ipAddress: ip ?? null
    });
    await this.acceptancesRepository.save(row);
    await this.auditService.log(
      userId,
      'privacy.policy.accepted',
      'privacy_policy',
      null,
      { version },
      ip ?? null
    );
    return { message: 'Aceptación registrada', version };
  }
}
