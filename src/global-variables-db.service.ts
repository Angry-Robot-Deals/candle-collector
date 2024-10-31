import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Injectable()
export class GlobalVariablesDBService {
  constructor(private prisma: PrismaService) {}

  async setGlobalVariable(id: string, val: number): Promise<void> {
    await this.prisma.globalVar.upsert({
      where: { id },
      update: { val },
      create: { id, val },
    });
  }

  async deleteGlobalVariable(id: string): Promise<void> {
    await this.prisma.globalVar.delete({
      where: { id },
    });
  }

  async getGlobalVariableValue(id: string): Promise<number | null> {
    const variable = await this.prisma.globalVar.findUnique({
      where: { id },
      select: { val: true },
    });
    return variable ? variable.val : null;
  }

  async getGlobalVariableTime(id: string): Promise<number | null> {
    const variable = await this.prisma.globalVar.findUnique({
      where: { id },
      select: { time: true },
    });
    return variable ? Math.floor(variable.time.getTime() / 1000) : null; // Преобразование в UNIX timestamp
  }
}
