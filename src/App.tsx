import { Route, Routes } from 'react-router-dom'
import { AuthenticatedApp } from './components/AuthenticatedApp'
import { HomePage } from './pages/HomePage'
import { FeedPage } from './pages/FeedPage'
import { LoginPage } from './pages/LoginPage'
import { MyPage } from './pages/MyPage'
import { NotFoundPage } from './pages/NotFoundPage'
import { SignupPage } from './pages/SignupPage'
import { RestaurantPage } from './pages/RestaurantPage'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route element={<AuthenticatedApp />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/feed" element={<FeedPage />} />
        <Route path="/restaurants/:restaurantId" element={<RestaurantPage />} />
        <Route path="/my" element={<MyPage />} />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
