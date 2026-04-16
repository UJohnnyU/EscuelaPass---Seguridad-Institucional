import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SchoolEntity } from '../../database/entities/school.entity';
import { UserEntity, UserRole } from '../../database/entities/user.entity';
import { AssignUserSchoolDto } from './dto/assign-user-school.dto';
import { CreateSchoolDto } from './dto/create-school.dto';
import { UpdateSchoolDto } from './dto/update-school.dto';

@Injectable()
export class SchoolsService {
  constructor(
    @InjectRepository(SchoolEntity)
    private readonly schoolsRepository: Repository<SchoolEntity>,
    @InjectRepository(UserEntity)
    private readonly usersRepository: Repository<UserEntity>
  ) {}

  list() {
    return this.schoolsRepository.find({ order: { name: 'ASC' } });
  }

  async get(id: string) {
    const row = await this.schoolsRepository.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Escuela no encontrada');
    return row;
  }

  async create(dto: CreateSchoolDto) {
    const existingByName = await this.schoolsRepository.findOne({ where: { name: dto.name.trim() } });
    if (existingByName) throw new ConflictException('Ya existe una escuela con ese nombre');
    const existingByCode = await this.schoolsRepository.findOne({ where: { code: dto.code.trim() } });
    if (existingByCode) throw new ConflictException('Ya existe una escuela con ese código');
    const row = this.schoolsRepository.create({
      name: dto.name.trim(),
      code: dto.code.trim(),
      status: true,
      maxGradeScale: dto.maxGradeScale.toFixed(2)
    });
    return this.schoolsRepository.save(row);
  }

  async update(id: string, dto: UpdateSchoolDto) {
    const row = await this.get(id);
    if (dto.name !== undefined) {
      const name = dto.name.trim();
      const clash = await this.schoolsRepository.findOne({ where: { name } });
      if (clash && clash.id !== row.id) throw new ConflictException('Ya existe una escuela con ese nombre');
      row.name = name;
    }
    if (dto.status !== undefined) row.status = dto.status;
    if (dto.maxGradeScale !== undefined) row.maxGradeScale = dto.maxGradeScale.toFixed(2);
    return this.schoolsRepository.save(row);
  }

  async assignUserSchool(dto: AssignUserSchoolDto) {
    const user = await this.usersRepository.findOne({ where: { id: dto.userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    const school = await this.schoolsRepository.findOne({ where: { id: dto.schoolId } });
    if (!school) throw new NotFoundException('Escuela no encontrada');
    user.schoolId = school.id;
    await this.usersRepository.save(user);
    return {
      userId: user.id,
      role: user.role,
      schoolId: school.id
    };
  }

  async listUsersBySchool(schoolId: string) {
    const school = await this.get(schoolId);
    const users = await this.usersRepository.find({
      where: { schoolId: school.id },
      order: { fullName: 'ASC' }
    });
    return users.map((u) => ({
      id: u.id,
      email: u.email,
      role: u.role,
      fullName: u.fullName,
      status: u.status
    }));
  }

  async createSchoolAdmin(schoolId: string, payload: { email: string; fullName: string; passwordHash: string }) {
    const school = await this.get(schoolId);
    const existing = await this.usersRepository.findOne({ where: { email: payload.email.trim() } });
    if (existing) throw new ConflictException('El correo ya está registrado');
    const user = this.usersRepository.create({
      email: payload.email.trim(),
      fullName: payload.fullName.trim(),
      passwordHash: payload.passwordHash,
      role: UserRole.ADMINISTRATIVO,
      canAccessCampus: true,
      status: true,
      schoolId: school.id
    });
    const saved = await this.usersRepository.save(user);
    return {
      id: saved.id,
      email: saved.email,
      role: saved.role,
      schoolId: saved.schoolId
    };
  }
}
