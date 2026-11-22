import type { ApiResponse } from "@/common/types/api";
import type { School, SchoolSettingsInput } from "@/common/types/identity";

export interface ISchoolService {
  getCurrent: () => ApiResponse<School>;
  update: (
    input: Partial<SchoolSettingsInput> & { logo?: string },
  ) => ApiResponse<School>;
  completeOnboarding: (input: SchoolSettingsInput) => ApiResponse<School>;
}
