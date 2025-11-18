//index.tsx

import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Home from '../components/Home';
import SearchPage from '../components/SearchPage';
import Categories from '../components/Categories';
import VideoPlayer from '../components/VideoPlayer';
import Profile from '../components/Profile';
import Favorites from './Favorites';
import History from './History';
import NotFound from './NotFound';
import UserSettings from '../components/UserSettings';
import AdminSettings from '../components/AdminSettings';
import TopRated from '../components/TopRated';
import SubscriptionGuard from '../components/SubscriptionGuard';

import Series from './Series';
import Movies from './Movies';
import Browse from './Browse';
import MyList from './MyList';

// Composant pour afficher le contenu sans redirection
const AuthRoute = ({ children }: { children: React.ReactNode }) => {
  return <>{children}</>;
};

const Index = () => {
  return (
    <Routes>
      {/* Page d'accueil - nécessite authentification + abonnement */}
      <Route path="/" element={
        <AuthRoute>
          <SubscriptionGuard>
            <Home />
          </SubscriptionGuard>
        </AuthRoute>
      } />
      
      {/* Pages nécessitant une authentification */}
      <Route path="/profile" element={
        <AuthRoute>
          <Profile />
        </AuthRoute>
      } />
      <Route path="/settings" element={
        <AuthRoute>
          <UserSettings />
        </AuthRoute>
      } />
      <Route path="/admin/settings" element={
        <AuthRoute>
          <AdminSettings />
        </AuthRoute>
      } />
      
      {/* Pages nécessitant authentification + abonnement */}
      <Route path="/search" element={
        <AuthRoute>
          <SubscriptionGuard>
            <SearchPage />
          </SubscriptionGuard>
        </AuthRoute>
      } />
      <Route path="/browse" element={
        <AuthRoute>
          <SubscriptionGuard>
            <Browse />
          </SubscriptionGuard>
        </AuthRoute>
      } />
      <Route path="/series" element={
        <AuthRoute>
          <SubscriptionGuard>
            <Series />
          </SubscriptionGuard>
        </AuthRoute>
      } />
      <Route path="/movies" element={
        <AuthRoute>
          <SubscriptionGuard>
            <Movies />
          </SubscriptionGuard>
        </AuthRoute>
      } />
      <Route path="/categories" element={
        <AuthRoute>
          <SubscriptionGuard>
            <Categories />
          </SubscriptionGuard>
        </AuthRoute>
      } />
      <Route path="/video/:id" element={
        <AuthRoute>
          <SubscriptionGuard>
            <VideoPlayer />
          </SubscriptionGuard>
        </AuthRoute>
      } />
      <Route path="/favorites" element={
        <AuthRoute>
          <SubscriptionGuard>
            <Favorites />
          </SubscriptionGuard>
        </AuthRoute>
      } />
      <Route path="/my-list" element={
        <AuthRoute>
          <SubscriptionGuard>
            <MyList />
          </SubscriptionGuard>
        </AuthRoute>
      } />
      <Route path="/history" element={
        <AuthRoute>
          <SubscriptionGuard>
            <History />
          </SubscriptionGuard>
        </AuthRoute>
      } />
      <Route path="/top-rated" element={
        <AuthRoute>
          <SubscriptionGuard>
            <TopRated />
          </SubscriptionGuard>
        </AuthRoute>
      } />
      
      {/* Page 404 */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

export default Index;