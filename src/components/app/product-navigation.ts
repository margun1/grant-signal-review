import { Boxes, FileSearch, TrendingUp, Wrench } from "lucide-react";

export const productPages = [
  {
    to: "/powerboard",
    label: "POWERBOARD",
    icon: TrendingUp,
    description: "가상 실증 자료와 월별 계측·절감 현황",
  },
  {
    to: "/drone",
    label: "드론",
    icon: Boxes,
    description: "교육용 드론 가상 실증 현황과 부품찾기",
  },
  {
    to: "/competitors",
    label: "경쟁제품",
    icon: FileSearch,
    description: "시연용 가상 유사업체 제품 검색",
  },
  {
    to: "/devices",
    label: "기기오류",
    icon: Wrench,
    description: "POWERBOARD와 드론 오류 등록 및 처리 상태 관리",
  },
] as const;
