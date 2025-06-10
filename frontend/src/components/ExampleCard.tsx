import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AlertCircle, CheckCircle2, Clock } from 'lucide-react';

interface ExampleCardProps {
  title: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  progress?: number;
  showForm?: boolean;
}

export const ExampleCard: React.FC<ExampleCardProps> = ({
  title,
  description,
  status,
  progress = 0,
  showForm = false
}) => {
  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'pending':
        return {
          badge: <Badge variant="secondary" className="text-amber-700 bg-amber-50"><Clock className="w-3 h-3 mr-1" />Pending</Badge>,
          icon: <Clock className="h-5 w-5 text-amber-500" />
        };
      case 'in_progress':
        return {
          badge: <Badge variant="default"><AlertCircle className="w-3 h-3 mr-1" />In Progress</Badge>,
          icon: <AlertCircle className="h-5 w-5 text-blue-500" />
        };
      case 'completed':
        return {
          badge: <Badge variant="default" className="text-green-700 bg-green-50"><CheckCircle2 className="w-3 h-3 mr-1" />Completed</Badge>,
          icon: <CheckCircle2 className="h-5 w-5 text-green-500" />
        };
      case 'failed':
        return {
          badge: <Badge variant="destructive"><AlertCircle className="w-3 h-3 mr-1" />Failed</Badge>,
          icon: <AlertCircle className="h-5 w-5 text-red-500" />
        };
      default:
        return {
          badge: <Badge variant="secondary">Unknown</Badge>,
          icon: <AlertCircle className="h-5 w-5 text-gray-500" />
        };
    }
  };

  const statusConfig = getStatusConfig(status);

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {statusConfig.icon}
            <CardTitle className="text-lg">{title}</CardTitle>
          </div>
          {statusConfig.badge}
        </div>
        {description && (
          <CardDescription>{description}</CardDescription>
        )}
      </CardHeader>
      
      <CardContent className="space-y-4">
        {progress > 0 && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Progress</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}
        
        {showForm && (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="example-input">Example Input</Label>
              <Input
                id="example-input"
                type="text"
                placeholder="Enter some text..."
                className="w-full"
              />
            </div>
          </div>
        )}
      </CardContent>
      
      <CardFooter className="flex justify-between">
        <Button variant="outline" size="sm">
          Cancel
        </Button>
        <Button size="sm">
          Continue
        </Button>
      </CardFooter>
    </Card>
  );
};

export default ExampleCard;