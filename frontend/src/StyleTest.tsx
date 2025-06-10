import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

export const StyleTest: React.FC = () => {
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-2">Styling Test</h1>
          <p className="text-muted-foreground">Testing Tailwind CSS + Shadcn/ui integration</p>
        </div>

        {/* Basic Elements */}
        <Card>
          <CardHeader>
            <CardTitle>Basic UI Components</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Buttons */}
            <div className="flex gap-3 flex-wrap">
              <Button>Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="destructive">Destructive</Button>
              <Button variant="ghost">Ghost</Button>
            </div>

            {/* Badges */}
            <div className="flex gap-3 flex-wrap">
              <Badge>Default</Badge>
              <Badge variant="secondary">Secondary</Badge>
              <Badge variant="destructive">Destructive</Badge>
              <Badge variant="outline">Outline</Badge>
            </div>

            {/* Progress */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progress Test</span>
                <span>75%</span>
              </div>
              <Progress value={75} />
            </div>
          </CardContent>
        </Card>

        {/* Legacy CSS Classes Test */}
        <Card>
          <CardHeader>
            <CardTitle>Legacy CSS Classes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="action-button primary">Legacy Primary Button</div>
            <div className="action-button secondary small">Legacy Secondary Small</div>
            <div className="status-badge pending">Pending Status</div>
            <div className="status-badge completed">Completed Status</div>
          </CardContent>
        </Card>

        {/* Color Palette Test */}
        <Card>
          <CardHeader>
            <CardTitle>Color Palette</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <div className="w-full h-16 bg-primary rounded"></div>
                <p className="text-sm text-center">Primary</p>
              </div>
              <div className="space-y-2">
                <div className="w-full h-16 bg-secondary rounded"></div>
                <p className="text-sm text-center">Secondary</p>
              </div>
              <div className="space-y-2">
                <div className="w-full h-16 bg-muted rounded"></div>
                <p className="text-sm text-center">Muted</p>
              </div>
              <div className="space-y-2">
                <div className="w-full h-16 bg-destructive rounded"></div>
                <p className="text-sm text-center">Destructive</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Typography Test */}
        <Card>
          <CardHeader>
            <CardTitle>Typography</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <h1 className="text-4xl font-bold">Heading 1</h1>
            <h2 className="text-3xl font-semibold">Heading 2</h2>
            <h3 className="text-2xl font-semibold">Heading 3</h3>
            <p className="text-base">Regular paragraph text with normal weight and spacing.</p>
            <p className="text-sm text-muted-foreground">Small muted text for secondary information.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default StyleTest;