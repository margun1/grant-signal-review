import { Boxes, FileSearch, TrendingUp } from "lucide-react";

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
    description: "교육용 드론 부품 목록과 가상 단가 검색",
  },
  {
    to: "/competitors",
    label: "경쟁제품",
    icon: FileSearch,
    description: "ESCO 공개 자료 기반 유사 업체·제품 비교",
  },
] as const;
