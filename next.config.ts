import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // 개발 모드 좌하단의 Next.js 표시기를 숨긴다 (시연 화면을 깨끗하게)
  devIndicators: false,
  // 같은 와이파이의 휴대폰·다른 PC(192.168.x.x)로 열어도 개발 서버 JS가 막히지 않게 한다
  allowedDevOrigins: ['192.168.*.*'],
}

export default nextConfig
