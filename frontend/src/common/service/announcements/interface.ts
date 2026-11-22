import type { ApiResponse, CursorPage } from "@/common/types/api";
import type { Announcement, AnnouncementInput } from "@/common/types/daily";
import type { RequestConfig } from "../http.service";

export interface IAnnouncementsService {
  feed: (
    cursor?: string,
    config?: RequestConfig,
  ) => ApiResponse<CursorPage<Announcement>>;
  scheduled: (config?: RequestConfig) => ApiResponse<Announcement[]>;
  create: (input: AnnouncementInput) => ApiResponse<Announcement>;
  remove: (id: string) => ApiResponse<void>;
  classSettings: (
    classId: string,
    config?: RequestConfig,
  ) => ApiResponse<{ assistantsCanPost: boolean }>;
  saveClassSettings: (
    classId: string,
    assistantsCanPost: boolean,
  ) => ApiResponse<{ assistantsCanPost: boolean }>;
}
