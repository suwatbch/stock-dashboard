'use client';

import {
  Container,
  Typography,
  Button,
  Card,
  CardContent,
  Grid,
  Box,
  AppBar,
  Toolbar,
  IconButton,
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import MenuIcon from '@mui/icons-material/Menu';

export default function Home() {
  return (
    <Box sx={{ flexGrow: 1 }}>
      {/* AppBar */}
      <AppBar position="static">
        <Toolbar>
          <IconButton
            size="large"
            edge="start"
            color="inherit"
            aria-label="menu"
            sx={{ mr: 2 }}
          >
            <MenuIcon />
          </IconButton>
          <DashboardIcon sx={{ mr: 1 }} />
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            EA Dashboard
          </Typography>
          <Button color="inherit">Login</Button>
        </Toolbar>
      </AppBar>

      {/* Main Content */}
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Typography
          variant="h4"
          component="h1"
          gutterBottom
          tw="font-bold text-center mb-8"
        >
          Welcome to EA Dashboard
        </Typography>

        <Typography variant="body1" tw="text-center text-gray-600 mb-8">
          Built with Next.js, MUI, and Twin.macro (Tailwind CSS)
        </Typography>

        <Grid container spacing={3}>
          {/* Card 1 */}
          <Grid size={{ xs: 12, sm: 6, md: 4 }}>
            <Card tw="hover:shadow-lg transition-shadow duration-300">
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  📊 Analytics
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  View real-time analytics and insights for your EA trading
                  strategies.
                </Typography>
                <Button variant="contained" sx={{ mt: 2 }} fullWidth>
                  View Analytics
                </Button>
              </CardContent>
            </Card>
          </Grid>

          {/* Card 2 */}
          <Grid size={{ xs: 12, sm: 6, md: 4 }}>
            <Card tw="hover:shadow-lg transition-shadow duration-300">
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  ⚙️ Settings
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Configure your EA parameters and trading preferences.
                </Typography>
                <Button variant="outlined" sx={{ mt: 2 }} fullWidth>
                  Open Settings
                </Button>
              </CardContent>
            </Card>
          </Grid>

          {/* Card 3 */}
          <Grid size={{ xs: 12, sm: 6, md: 4 }}>
            <Card tw="hover:shadow-lg transition-shadow duration-300">
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  📈 Performance
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Track your trading performance and historical data.
                </Typography>
                <Button
                  variant="contained"
                  color="secondary"
                  sx={{ mt: 2 }}
                  fullWidth
                >
                  View Performance
                </Button>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Twin.macro Demo Section */}
        <Box tw="mt-12 p-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl text-white text-center">
          <Typography variant="h5" tw="font-bold mb-4">
            🎨 Twin.macro + Tailwind CSS
          </Typography>
          <Typography variant="body1" tw="mb-4">
            This section is styled using Twin.macro with Tailwind CSS classes!
          </Typography>
          <Box tw="flex justify-center gap-4 flex-wrap">
            <Button
              variant="contained"
              sx={{
                backgroundColor: 'white',
                color: '#1976d2',
                '&:hover': { backgroundColor: '#f5f5f5' },
              }}
            >
              Primary Action
            </Button>
            <Button
              variant="outlined"
              sx={{
                borderColor: 'white',
                color: 'white',
                '&:hover': { backgroundColor: 'rgba(255,255,255,0.1)' },
              }}
            >
              Secondary Action
            </Button>
          </Box>
        </Box>
      </Container>
    </Box>
  );
}
