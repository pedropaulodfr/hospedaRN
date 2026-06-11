import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-usuario.decorator';
import { PerfilUsuario } from '@prisma/client';
@ApiTags('Reports')
@ApiBearerAuth('JWT-auth')
@Controller('reports')
export class ReportsController {
  constructor(private readonly service: ReportsService) {}
  @Get('dashboard') @Roles(PerfilUsuario.ADMIN) globalDashboard() { return this.service.globalDashboard(); }
  @Get('reservas/by-cidade') @Roles(PerfilUsuario.ADMIN) reservationsByCity() { return this.service.reservationsByCity(); }
  @Get('reservas/by-status') reservationsByStatus(@Query('estabelecimentoId') estId?: string) { return this.service.reservationsByEstablishment(estId); }
  @Get('occupancy/:estabelecimentoId') occupancy(@Param('estabelecimentoId') id: string, @Query('month') month: string, @Query('year') year: string) { return this.service.occupancyReport(id, parseInt(month), parseInt(year)); }
  @Get('eventos/upcoming') @Roles(PerfilUsuario.ADMIN) upcomingEvents() { return this.service.upcomingEvents(); }
  @Get('cancellations') @Roles(PerfilUsuario.ADMIN) cancellations() { return this.service.cancellationReport(); }
}
