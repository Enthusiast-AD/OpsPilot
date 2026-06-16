import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'jwt_secret_key';

export const authCrypto = {
  hashPassword: async (password: string): Promise<string> => {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
  },

  comparePassword: async (password: string, hash: string): Promise<boolean> => {
    return bcrypt.compare(password, hash);
  },

  generateToken: (payload: { userId: string; email: string; role: "SUPERVISOR" | "WORKER"; organizationId: string }): string => {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
  },

  verifyToken: (token: string) => {
    try {
      return jwt.verify(token, JWT_SECRET) as {
        userId: string;
        email: string;
        role: "SUPERVISOR" | "WORKER";
        organizationId: string;
      };
    } catch (error) {
      return null;
    }
  },
};