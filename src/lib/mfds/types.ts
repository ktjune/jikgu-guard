// 식약처 BlockRawIrdntInfoService API 원본 응답 타입

export interface MfdsBlockedIngredientRaw {
  APPN_RELS_DVS: string        // 적용/해제 구분: "Y"=적용중, "N"=해제
  RAW_IRDNT_NM: string         // 원료·성분명(한글)
  RAW_IRDNT_ENG_NM: string | null  // 원료·성분명(영문)
  RAW_IRDNT_ETC_NM: string | null  // 기타명칭
  APPN_DT: string | null       // 지정일자 "YYYY-MM-DD"
  RELS_DT: string | null       // 해제일자 "YYYY-MM-DD"
  APPN_RSN: string | null      // 지정사유
  RELS_RSN: string | null      // 해제사유
}

// 실제 API 응답 구조 (response 래퍼 없음)
export interface MfdsApiResponse {
  header: {
    resultCode: string
    resultMsg: string
  }
  body: {
    numOfRows: number
    pageNo: number
    totalCount: number
    items: MfdsBlockedIngredientRaw[] | null | ''
  }
}
