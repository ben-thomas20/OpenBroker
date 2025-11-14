import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { RainbowButton } from '@/components/ui/rainbow-button';
import { Input } from '../components/common/Input';
import { DitheringShader } from '@/components/ui/dithering-shader';
import { MagicTextReveal } from '@/components/ui/magic-text-reveal';
import { HoverGlassContainer } from '@/components/ui/hover-glass-container';

export function LoginPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [offerCode, setOfferCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [fontSize, setFontSize] = useState(85);
  const { login, register, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  // Handle responsive font size
  useEffect(() => {
    const updateFontSize = () => {
      setFontSize(window.innerWidth < 768 ? 60 : 85);
    };
    updateFontSize();
    window.addEventListener('resize', updateFontSize);
    return () => window.removeEventListener('resize', updateFontSize);
  }, []);

  // Navigate when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      console.log('LoginPage: User is authenticated, navigating to /app');
      navigate('/app', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login({ email, password });
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Login failed. Please check your credentials.');
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await register({ offerCode, name, email, password });
      navigate('/app');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full h-screen bg-black relative overflow-hidden">
      <DitheringShader
        shape="wave"
        type="8x8"
        colorBack="#0a0a0a"
        colorFront="#2a2a2a"
        pxSize={3}
        speed={0.6}
        opacity={0.4}
        className="absolute inset-0 w-full h-full"
      />
      <div className="absolute inset-0 flex flex-col items-center justify-center p-4 z-10">
        <div className="w-full text-center mb-8 relative z-10">
          <div className="flex justify-center mb-2">
            <MagicTextReveal
              text="OpenBroker"
              color="rgba(255, 255, 255, 1)"
              fontSize={fontSize}
              fontFamily="'Creato Display', sans-serif"
              fontWeight={400}
              spread={40}
              speed={0.5}
              density={4}
              resetOnMouseLeave={true}
              className="mb-2"
            />
          </div>
          <p className="text-gray-300/80 text-lg mt-2">The imaginary brokerage</p>
        </div>

        <div className="w-full max-w-md">
        <HoverGlassContainer className="p-8">
          {/* Content wrapper */}
          <div className="relative z-10">
          <div className="flex gap-2 mb-6 bg-black/20 rounded-xl p-1 backdrop-blur-sm">
            <button
              onClick={() => {
                setIsLogin(true);
                setError('');
              }}
              className={`flex-1 py-2.5 px-4 rounded-lg font-semibold transition-all duration-300 ${
                isLogin
                  ? 'bg-white/20 text-white shadow-lg backdrop-blur-sm'
                  : 'text-gray-300 hover:text-white hover:bg-white/5'
              }`}
            >
              Login
            </button>
            <button
              onClick={() => {
                setIsLogin(false);
                setError('');
              }}
              className={`flex-1 py-2.5 px-4 rounded-lg font-semibold transition-all duration-300 ${
                !isLogin
                  ? 'bg-white/20 text-white shadow-lg backdrop-blur-sm'
                  : 'text-gray-300 hover:text-white hover:bg-white/5'
              }`}
            >
              Register
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-500/10 backdrop-blur-sm border border-red-500/50 rounded-xl text-red-300 text-sm">
              {error}
            </div>
          )}

          {isLogin ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <Input
                type="email"
                label="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="Enter your email"
              />
              <Input
                type="password"
                label="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Enter your password"
              />
              <RainbowButton type="submit" className="w-full" disabled={loading}>
                {loading ? 'Logging in...' : 'Login'}
              </RainbowButton>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              <Input
                label="Offer code"
                value={offerCode}
                onChange={(e) => setOfferCode(e.target.value)}
                placeholder="Enter offer code"
              />
              <Input
                label="Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Enter your name"
              />
              <Input
                type="email"
                label="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="Enter your email"
              />
              <Input
                type="password"
                label="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Create a password"
              />
              <RainbowButton type="submit" className="w-full" disabled={loading}>
                {loading ? 'Registering...' : 'Register'}
              </RainbowButton>
            </form>
          )}
          </div>
        </HoverGlassContainer>
        </div>
      </div>
    </div>
  );
}

