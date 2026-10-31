import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { PreferencesProvider } from './context/PreferencesContext';
import { AudioPlayerProvider } from './context/AudioPlayerContext';
import { NotificationProvider } from './context/NotificationContext';
import { AuthProvider } from './context/AuthContext';
import { Navbar } from './components/layout/Navbar';
import { Sidebar } from './components/layout/Sidebar';
import { MobileNav } from './components/layout/MobileNav';
import { AudioPlayerBar } from './components/audio/AudioPlayerBar';
import { QuietNotificationCenter } from './components/notifications/QuietNotificationCenter';
import { AuthModal } from './components/auth/AuthModal';
import { OnboardingModal } from './components/common/OnboardingModal';

// Pages
import { HomePage } from './pages/HomePage';
import { StateNewsPage } from './pages/StateNewsPage';
import { NationalNewsPage } from './pages/NationalNewsPage';
import { InternationalNewsPage } from './pages/InternationalNewsPage';
import { HourlyPulsePage } from './pages/HourlyPulsePage';
import { PerspectivesPage } from './pages/PerspectivesPage';
import { AskTheNewsPage } from './pages/AskTheNewsPage';
import { VocabularyPage } from './pages/VocabularyPage';
import { SavedStoriesPage } from './pages/SavedStoriesPage';
import { ArticleDetailPage } from './pages/ArticleDetailPage';
import { SettingsPage } from './pages/SettingsPage';
import { AdminPage } from './pages/AdminPage';

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <PreferencesProvider>
          <AudioPlayerProvider>
            <NotificationProvider>
              <BrowserRouter>
                <div className="min-h-screen bg-paper-light dark:bg-night-bg text-ink-primary dark:text-nightText-primary transition-colors flex flex-col font-sans">
                  {/* Top Editorial Navbar */}
                  <Navbar />

                  {/* Main Content Area */}
                  <div className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 flex">
                    {/* Left Desktop Sidebar */}
                    <Sidebar />

                    {/* Center Main Stage */}
                    <main className="flex-1 min-w-0 py-6 md:pl-8">
                      <Routes>
                        <Route path="/" element={<HomePage />} />
                        <Route path="/state-news" element={<StateNewsPage />} />
                        <Route path="/national-news" element={<NationalNewsPage />} />
                        <Route path="/international-news" element={<InternationalNewsPage />} />
                        <Route path="/hourly-pulse" element={<HourlyPulsePage />} />
                        <Route path="/perspectives" element={<PerspectivesPage />} />
                        <Route path="/ask" element={<AskTheNewsPage />} />
                        <Route path="/vocabulary" element={<VocabularyPage />} />
                        <Route path="/saved" element={<SavedStoriesPage />} />
                        <Route path="/stories/:id" element={<ArticleDetailPage />} />
                        <Route path="/settings" element={<SettingsPage />} />
                        <Route path="/admin" element={<AdminPage />} />
                      </Routes>
                    </main>
                  </div>

                  {/* Persistent Audio Player Bar */}
                  <AudioPlayerBar />

                  {/* Quiet Notification Drawer */}
                  <QuietNotificationCenter />

                  {/* Auth Modal for Login/Registration */}
                  <AuthModal />

                  {/* First-time User Onboarding Modal */}
                  <OnboardingModal />

                  {/* Mobile Bottom Tab Navigation */}
                  <MobileNav />
                </div>
              </BrowserRouter>
            </NotificationProvider>
          </AudioPlayerProvider>
        </PreferencesProvider>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;
