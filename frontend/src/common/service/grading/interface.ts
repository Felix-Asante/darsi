import type { ApiResponse } from "@/common/types/api";
import type {
  AggregationMethod,
  Conversion,
  GradingPolicy,
  GradingScale,
  ScaleDefinition,
  ScalePreset,
} from "@/common/types/assessment";
import type { RequestConfig } from "../http.service";

export interface IGradingService {
  presets: (config?: RequestConfig) => ApiResponse<ScalePreset[]>;
  listScales: (config?: RequestConfig) => ApiResponse<GradingScale[]>;
  createScale: (input: {
    name: string;
    definition: ScaleDefinition;
  }) => ApiResponse<GradingScale>;
  /** Saves a new version; grades keep the version they were given with. */
  updateScale: (
    id: string,
    input: { name: string; definition: ScaleDefinition },
  ) => ApiResponse<GradingScale>;
  listConversions: (config?: RequestConfig) => ApiResponse<Conversion[]>;
  saveConversion: (input: {
    fromScaleId: string;
    toScaleId: string;
    mapping: Record<string, string>;
  }) => ApiResponse<Conversion>;
  convert: (input: {
    fromScaleId: string;
    toScaleId: string;
    value: string;
  }) => ApiResponse<{ value: string | number }>;
  listPolicies: (config?: RequestConfig) => ApiResponse<GradingPolicy[]>;
  savePolicy: (input: {
    subjectId: string | null;
    reportingScaleId: string | null;
    method: AggregationMethod;
    categories: { name: string; weight: number }[];
  }) => ApiResponse<GradingPolicy>;
}
