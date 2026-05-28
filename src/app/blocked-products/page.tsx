import BlockedProductsClient from './_client'

export const metadata = {
  title: '위해 제품 목록 | 직구가드',
  description: '식약처가 통보한 해외직구식품 위해 제품 현황',
}

export default function BlockedProductsPage() {
  return <BlockedProductsClient />
}
