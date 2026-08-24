import { useState, type FormEvent } from 'react'

interface ProfileSetupProps {
  initialNickname: string
  onSave: (nickname: string) => Promise<void>
}

export function ProfileSetup({ initialNickname, onSave }: ProfileSetupProps) {
  const [nickname, setNickname] = useState(initialNickname)
  const [message, setMessage] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedNickname = nickname.trim()

    if (trimmedNickname.length < 2 || trimmedNickname.length > 40) {
      setMessage('닉네임은 2자 이상 40자 이하로 입력해 주세요.')
      return
    }

    setIsSaving(true)
    setMessage('')
    try {
      await onSave(trimmedNickname)
    } catch {
      setMessage('프로필을 저장하지 못했습니다. 다시 시도해 주세요.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="profile-setup-title">
        <LinkLogo />
        <h1 id="profile-setup-title">어떻게 불러드릴까요?</h1>
        <p>지도에서 친구들에게 보일 닉네임을 정해 주세요.</p>
        <form className="auth-form" onSubmit={handleSubmit}>
          <label htmlFor="profile-nickname">닉네임</label>
          <input
            id="profile-nickname"
            value={nickname}
            onChange={(event) => setNickname(event.target.value)}
            autoComplete="nickname"
            minLength={2}
            maxLength={40}
            required
          />
          {message && (
            <p className="form-message form-message--error" role="alert">
              {message}
            </p>
          )}
          <button className="primary-button" type="submit" disabled={isSaving}>
            {isSaving ? '저장 중…' : '시작하기'}
          </button>
        </form>
      </section>
    </main>
  )
}

function LinkLogo() {
  return <div className="auth-wordmark">whomadethis</div>
}
