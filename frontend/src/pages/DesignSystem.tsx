import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import ExampleCard from '@/components/ExampleCard';
import { 
  Settings, 
  AlertCircle, 
  CheckCircle2, 
  Info, 
  Database,
  Cog,
  FileText,
  BarChart3,
  Users
} from 'lucide-react';

const DesignSystem: React.FC = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">FossaWork V2 Design System</h1>
              <p className="text-muted-foreground mt-1">
                Tailwind CSS v4 + Shadcn/ui Component Library
              </p>
            </div>
            <Badge variant="outline" className="text-primary">
              v2.0.0
            </Badge>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-8 space-y-12">
        
        {/* Color Palette */}
        <section>
          <h2 className="text-2xl font-semibold mb-6">Color Palette</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Primary Colors</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-5 gap-2">
                  {[50, 100, 200, 300, 400, 500, 600, 700, 800, 900].map((shade) => (
                    <div key={shade} className="text-center">
                      <div 
                        className={`w-full h-12 rounded mb-1`}
                        style={{ backgroundColor: `var(--color-primary-${shade})` }}
                      />
                      <span className="text-xs text-muted-foreground">{shade}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle>Neutral Colors</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-5 gap-2">
                  {[50, 100, 200, 300, 400, 500, 600, 700, 800, 900].map((shade) => (
                    <div key={shade} className="text-center">
                      <div 
                        className={`w-full h-12 rounded mb-1`}
                        style={{ backgroundColor: `var(--color-slate-${shade})` }}
                      />
                      <span className="text-xs text-muted-foreground">{shade}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Semantic Colors</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center space-x-3">
                  <div className="w-6 h-6 bg-background border rounded" />
                  <span className="text-sm">Background</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-6 h-6 bg-card border rounded" />
                  <span className="text-sm">Card</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-6 h-6 bg-primary rounded" />
                  <span className="text-sm">Primary</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-6 h-6 bg-secondary rounded" />
                  <span className="text-sm">Secondary</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-6 h-6 bg-destructive rounded" />
                  <span className="text-sm">Destructive</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Typography */}
        <section>
          <h2 className="text-2xl font-semibold mb-6">Typography</h2>
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div>
                <h1 className="text-4xl font-bold">Heading 1 - Bold 4xl</h1>
                <h2 className="text-3xl font-semibold">Heading 2 - Semibold 3xl</h2>
                <h3 className="text-2xl font-semibold">Heading 3 - Semibold 2xl</h3>
                <h4 className="text-xl font-medium">Heading 4 - Medium xl</h4>
                <h5 className="text-lg font-medium">Heading 5 - Medium lg</h5>
                <h6 className="text-base font-medium">Heading 6 - Medium base</h6>
              </div>
              <div className="space-y-2">
                <p className="text-base">Body text - Regular base size with proper line height for readability.</p>
                <p className="text-sm text-muted-foreground">Small text - Used for captions, timestamps, and secondary information.</p>
                <p className="text-xs text-muted-foreground">Extra small text - Used for labels and micro-copy.</p>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Buttons */}
        <section>
          <h2 className="text-2xl font-semibold mb-6">Buttons</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Button Variants</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-3">
                  <Button>Default</Button>
                  <Button variant="destructive">Destructive</Button>
                  <Button variant="outline">Outline</Button>
                  <Button variant="secondary">Secondary</Button>
                  <Button variant="ghost">Ghost</Button>
                  <Button variant="link">Link</Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Button Sizes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <Button size="sm">Small</Button>
                  <Button size="default">Default</Button>
                  <Button size="lg">Large</Button>
                  <Button size="icon"><Settings className="h-4 w-4" /></Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Form Elements */}
        <section>
          <h2 className="text-2xl font-semibold mb-6">Form Elements</h2>
          <Card>
            <CardHeader>
              <CardTitle>Form Components</CardTitle>
              <CardDescription>
                Input fields, labels, and form controls
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" placeholder="Enter your email" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input id="password" type="password" placeholder="Enter your password" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="disabled">Disabled Input</Label>
                    <Input id="disabled" disabled placeholder="Disabled input" />
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="textarea">Description</Label>
                    <Textarea id="textarea" placeholder="Enter a description..." />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Status Elements */}
        <section>
          <h2 className="text-2xl font-semibold mb-6">Status & Feedback</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Badges</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-3">
                  <Badge>Default</Badge>
                  <Badge variant="secondary">Secondary</Badge>
                  <Badge variant="destructive">Destructive</Badge>
                  <Badge variant="outline">Outline</Badge>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Badge className="bg-green-100 text-green-800 hover:bg-green-200">
                    <CheckCircle2 className="w-3 h-3 mr-1" />
                    Success
                  </Badge>
                  <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-200">
                    <AlertCircle className="w-3 h-3 mr-1" />
                    Warning
                  </Badge>
                  <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-200">
                    <Info className="w-3 h-3 mr-1" />
                    Info
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Progress Indicators</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Progress 25%</span>
                    <span>25%</span>
                  </div>
                  <Progress value={25} />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Progress 65%</span>
                    <span>65%</span>
                  </div>
                  <Progress value={65} />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Progress 100%</span>
                    <span>100%</span>
                  </div>
                  <Progress value={100} />
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Data Display */}
        <section>
          <h2 className="text-2xl font-semibold mb-6">Data Display</h2>
          <Card>
            <CardHeader>
              <CardTitle>Work Orders Table</CardTitle>
              <CardDescription>
                Example table showing work order data with status indicators
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Work Order</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">WO-2024-001</TableCell>
                    <TableCell>Station A - Downtown</TableCell>
                    <TableCell>
                      <Badge className="bg-blue-100 text-blue-800">In Progress</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Progress value={75} className="w-16" />
                        <span className="text-sm text-muted-foreground">75%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline">View</Button>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">WO-2024-002</TableCell>
                    <TableCell>Station B - Highway</TableCell>
                    <TableCell>
                      <Badge className="bg-green-100 text-green-800">Completed</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Progress value={100} className="w-16" />
                        <span className="text-sm text-muted-foreground">100%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline">View</Button>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">WO-2024-003</TableCell>
                    <TableCell>Station C - Mall</TableCell>
                    <TableCell>
                      <Badge className="bg-amber-100 text-amber-800">Pending</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Progress value={0} className="w-16" />
                        <span className="text-sm text-muted-foreground">0%</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline">View</Button>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </section>

        {/* Example Cards */}
        <section>
          <h2 className="text-2xl font-semibold mb-6">Component Examples</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <ExampleCard
              title="Automation Task"
              description="Processing fuel dispenser automation for Station A"
              status="in_progress"
              progress={45}
            />
            <ExampleCard
              title="Form Submission"
              description="User credential verification complete"
              status="completed"
              progress={100}
            />
            <ExampleCard
              title="Data Export"
              description="Export work order data to CSV format"
              status="pending"
              showForm={true}
            />
          </div>
        </section>

        {/* Alerts */}
        <section>
          <h2 className="text-2xl font-semibold mb-6">Alerts & Messages</h2>
          <div className="space-y-4">
            <Alert>
              <Info className="h-4 w-4" />
              <div>
                <h4 className="font-semibold">Information</h4>
                <p className="text-sm text-muted-foreground">
                  This is an informational message with additional context.
                </p>
              </div>
            </Alert>
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <div>
                <h4 className="font-semibold">Error</h4>
                <p className="text-sm">
                  Something went wrong. Please check your input and try again.
                </p>
              </div>
            </Alert>
          </div>
        </section>

        {/* Footer */}
        <footer className="text-center py-8 border-t">
          <p className="text-muted-foreground">
            FossaWork V2 Design System - Built with Tailwind CSS v4 & Shadcn/ui
          </p>
        </footer>
      </div>
    </div>
  );
};

export default DesignSystem;