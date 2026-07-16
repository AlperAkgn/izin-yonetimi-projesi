type LoginResult =
  | { success: true; user: { id: string; name: string; role: 'EMPLOYEE' | 'HR' | 'ADMIN'; isFirstLogin: boolean }; token: string }
  | { success: false; message: string };

// Backend hazır olunca bu fonksiyonun İÇİNİ değiştireceğiz, login.tsx hiç değişmeyecek.
export async function loginRequest(email: string, password: string): Promise<LoginResult> {
  await new Promise((r) => setTimeout(r, 500)); // gerçek ağ gecikmesini simüle ediyoruz

  if (email === 'test@permitflow.com' && password === '123456') {
    return {
      success: true,
      token: 'sahte-jwt-token',
      user: { id: '1', name: 'Test Kullanıcı', role: 'ADMIN', isFirstLogin: true },
    };
  }
  return { success: false, message: 'E-posta veya şifre hatalı' };

  // ---- Backend hazır olunca yukarıdaki mock'u silip bunu aç ----
  // const response = await fetch('http://<backend-url>/auth/login', {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify({ email, password }),
  // });
  // if (!response.ok) {
  //   const err = await response.json();
  //   return { success: false, message: err.message ?? 'Giriş başarısız' };
  // }
  // const data = await response.json();
  // return { success: true, token: data.token, user: data.user };
}