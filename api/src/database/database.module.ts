import {
  Injectable,
  Module,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { EnvironmentVariables } from '../config/env.validation.js';
import { buildDataSourceOptions } from './typeorm.options.js';

/**
 * Row-level security is the backstop for tenant isolation, and superusers and
 * BYPASSRLS roles skip it. Refuse to start rather than run without it.
 */
@Injectable()
class RuntimeRoleGuard implements OnApplicationBootstrap {
  constructor(private readonly dataSource: DataSource) {}

  async onApplicationBootstrap(): Promise<void> {
    const [role] = await this.dataSource.query<
      { name: string; bypasses: boolean }[]
    >(
      `SELECT rolname AS name, rolsuper OR rolbypassrls AS bypasses FROM pg_roles WHERE rolname = current_user`,
    );
    if (role.bypasses) {
      throw new Error(
        `DATABASE_URL connects as "${role.name}", which bypasses row-level security. ` +
          'Use the runtime role created by the migrations.',
      );
    }
  }
}

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvironmentVariables, true>) => ({
        ...buildDataSourceOptions(config.get('DATABASE_URL', { infer: true })),
        autoLoadEntities: true,
      }),
    }),
  ],
  providers: [RuntimeRoleGuard],
})
export class DatabaseModule {}
