import { NaverMap } from '../components/NaverMap'
import { RestaurantSearch } from '../components/RestaurantSearch'
import { isSupabaseConfigured } from '../lib/supabase'

export function HomePage() {
  const isMapConfigured = Boolean(
    import.meta.env.VITE_NAVER_MAP_CLIENT_ID?.trim(),
  )

  return (
    <main>
      <header className="hero">
        <div>
          <p className="eyebrow">SHARED FOOD MAP</p>
          <h1>whomadethis</h1>
          <p>친구들과 함께 다녀온 맛있는 장소를 한 지도에 기록하세요.</p>
        </div>
        <div className="status-card" aria-label="개발 환경 상태">
          <span>초기 개발 환경</span>
          <ul>
            <li data-ready={isMapConfigured}>NAVER Maps</li>
            <li data-ready={isSupabaseConfigured}>Supabase</li>
            <li data-ready="true">Search proxy</li>
          </ul>
        </div>
      </header>

      <div className="workspace">
        <RestaurantSearch />
        <section className="map-panel" aria-labelledby="map-title">
          <div className="map-heading">
            <div>
              <p className="eyebrow">OUR MAP</p>
              <h2 id="map-title">친구들의 맛집 지도</h2>
            </div>
            <span className="milestone">Milestone 0 · foundation</span>
          </div>
          <NaverMap />
        </section>
      </div>
    </main>
  )
}
