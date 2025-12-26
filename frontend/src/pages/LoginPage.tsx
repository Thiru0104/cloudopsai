import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { apiClient, apiConfig } from '../config/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/card';
import { ShieldCheck, Lock, Mail, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const formData = new FormData();
      formData.append('username', email);
      formData.append('password', password);

      const response = await apiClient.postForm(apiConfig.endpoints.login, formData);
      
      const { access_token, user } = response;
      if (access_token && user) {
        login(access_token, user);
        toast.success('Successfully logged in!');
        navigate('/');
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (error: any) {
      console.error(error);
      let errorMessage = 'Failed to login. Please check your credentials.';
      
      if (error.message && error.message.includes('401')) {
        errorMessage = 'Wrong username or password. Please try again.';
      } else if (error.response && error.response.status === 401) {
        errorMessage = 'Wrong username or password. Please try again.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 px-4">
      <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))] opacity-20"></div>
      
      <Card className="w-full max-w-md bg-gray-900 border-gray-800 text-white relative z-10 shadow-2xl">
        <CardHeader className="space-y-1 pb-2">
          <div className="flex justify-center mb-6">
            <div className="p-4 bg-blue-600/20 rounded-full ring-1 ring-blue-500/50">
              <ShieldCheck className="h-10 w-10 text-blue-500" />
            </div>
          </div>
          <CardTitle className="text-2xl text-center font-bold tracking-tight">Welcome Back</CardTitle>
          <CardDescription className="text-center text-gray-400">
            Sign in to CloudOpsAI Platform
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative group">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-500 group-hover:text-gray-300 transition-colors" />
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="name@company.com" 
                  className="pl-10 !bg-gray-950 text-white placeholder:text-gray-400 border-gray-800 focus:border-blue-500 transition-colors"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <a href="#" className="text-xs text-blue-400 hover:text-blue-300">Forgot password?</a>
              </div>
              <div className="relative group">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-gray-500 group-hover:text-gray-300 transition-colors" />
                <Input 
                  id="password" 
                  type="password" 
                  className="pl-10 !bg-gray-950 text-white placeholder:text-gray-400 border-gray-800 focus:border-blue-500 transition-colors"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>
            <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Authenticating...
                </>
              ) : (
                'Sign In'
              )}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col space-y-4 pt-2 pb-6 text-center">
            <div className="text-sm text-gray-500">
                Don't have an account? <a href="#" className="text-blue-400 hover:text-blue-300">Contact Admin</a>
            </div>
            <p className="text-xs text-gray-600">
                Protected by Enterprise Grade Security
            </p>
        </CardFooter>
      </Card>
    </div>
  );
};

export default LoginPage;
