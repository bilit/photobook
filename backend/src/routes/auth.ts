import { Router, Request, Response, NextFunction } from 'express';
import passport from 'passport';
import { Strategy as GoogleStrategy, Profile, VerifyCallback } from 'passport-google-oauth20';
import dotenv from 'dotenv';

dotenv.config();

const router = Router();

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

declare global {
  namespace Express {
    interface User {
      id: string;
      displayName: string;
      email: string;
      accessToken: string;
      refreshToken: string;
    }
  }
}

passport.use(new GoogleStrategy(
  {
    clientID: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    callbackURL: `${BACKEND_URL}/auth/google/callback`,
    scope: ['profile', 'email', 'https://www.googleapis.com/auth/photoslibrary.readonly'],
  },
  (_accessToken: string, _refreshToken: string, profile: Profile, done: VerifyCallback) => {
    const user: Express.User = {
      id: profile.id,
      displayName: profile.displayName,
      email: profile.emails?.[0]?.value || '',
      accessToken: _accessToken,
      refreshToken: _refreshToken,
    };
    return done(null, user);
  }
));

passport.serializeUser((user, done) => {
  done(null, user);
});

passport.deserializeUser((user: Express.User, done) => {
  done(null, user);
});

router.get('/google', passport.authenticate('google'));

router.get(
  '/google/callback',
  passport.authenticate('google', { failureRedirect: `${FRONTEND_URL}/?error=auth_failed` }),
  (_req: Request, res: Response) => {
    res.redirect(`${FRONTEND_URL}/editor`);
  }
);

router.get('/status', (req: Request, res: Response) => {
  if (req.isAuthenticated() && req.user) {
    res.json({
      loggedIn: true,
      user: {
        id: req.user.id,
        displayName: req.user.displayName,
        email: req.user.email,
      },
    });
  } else {
    res.json({ loggedIn: false });
  }
});

router.get('/logout', (req: Request, res: Response, next: NextFunction) => {
  req.logout((err) => {
    if (err) return next(err);
    res.json({ success: true });
  });
});

export default router;
