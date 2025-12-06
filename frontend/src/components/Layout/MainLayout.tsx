import React from 'react';
import { Outlet } from 'react-router-dom';
import { Box, CssBaseline, Container } from '@mui/material';
import Navbar from './Navbar';
import Footer from './Footer';

const MainLayout: React.FC = () => {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <CssBaseline />
      <Navbar />
      <Container component="main" sx={{ flexGrow: 1, py: 4 }}>
        <Outlet />
      </Container>
      <Footer />
    </Box>
  );
};

export default MainLayout;