import React, { useState } from 'react';
import { BarChart, PieChart, ChevronDown, ChevronUp } from 'lucide-react';
import { Card } from '../ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/Tabs';
import { FilterCalculationResult } from '../../types/filters';
import { WorkOrder } from '../../services/api';
import { cn } from '../../lib/utils';

interface FilterVisualizationProps {
  filterData: FilterCalculationResult | null;
  workOrders: WorkOrder[];
}

export default function FilterVisualization({ filterData, workOrders }: FilterVisualizationProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  if (!filterData) return null;

  // Calculate data for charts
  const filterDistribution = filterData.summary.map(item => ({
    name: item.partNumber,
    value: item.quantity,
    description: item.description,
    percentage: Math.round((item.quantity / filterData.totalFilters) * 100)
  }));

  // Store analysis
  const storeAnalysis = Object.entries(
    workOrders.reduce((acc, order) => {
      const storeName = order.site_name || 'Unknown';
      if (!acc[storeName]) {
        acc[storeName] = { count: 0, filters: 0, chain: storeName.split('#')[0]?.trim() || 'Unknown' };
      }
      acc[storeName].count++;
      
      // Find corresponding filter detail
      const detail = filterData.details.find(d => d.jobId === order.external_id);
      if (detail) {
        acc[storeName].filters += Object.values(detail.filters)
          .reduce((sum, f) => sum + f.quantity, 0);
      }
      
      return acc;
    }, {} as Record<string, { count: number; filters: number; chain: string }>)
  ).map(([store, data]) => ({
    store,
    workOrders: data.count,
    filters: data.filters,
    chain: data.chain
  })).sort((a, b) => b.filters - a.filters).slice(0, 10); // Top 10 stores

  // Chain breakdown
  const chainBreakdown = Object.entries(
    filterData.summary.reduce((acc, item) => {
      const chainFilters = filterData.details.reduce((sum, detail) => {
        const chain = detail.customerName || 'Unknown';
        if (!acc[chain]) acc[chain] = {};
        if (!acc[chain][item.partNumber]) acc[chain][item.partNumber] = 0;
        
        if (detail.filters[item.partNumber]) {
          acc[chain][item.partNumber] += detail.filters[item.partNumber].quantity;
        }
        
        return acc;
      }, {} as Record<string, Record<string, number>>);
      
      return chainFilters;
    }, {} as Record<string, Record<string, number>>)
  ).map(([chain, filters]) => ({
    chain,
    filters: Object.entries(filters).map(([partNumber, quantity]) => ({
      partNumber,
      quantity,
      description: filterData.summary.find(s => s.partNumber === partNumber)?.description || ''
    }))
  }));

  return (
    <Card className="overflow-hidden">
      <div 
        className="p-4 border-b cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Filter Analytics</h3>
          </div>
          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </div>

      {isExpanded && (
        <div className="p-4">
          <Tabs defaultValue="distribution" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="distribution">Distribution</TabsTrigger>
              <TabsTrigger value="stores">Top Stores</TabsTrigger>
              <TabsTrigger value="chains">By Chain</TabsTrigger>
            </TabsList>

            <TabsContent value="distribution" className="mt-4">
              <div className="space-y-4">
                <h4 className="text-sm font-medium text-muted-foreground">
                  Filter Type Distribution
                </h4>
                
                {/* Simple bar chart visualization */}
                <div className="space-y-3">
                  {filterDistribution.map(item => (
                    <div key={item.name} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-mono">{item.name}</span>
                        <span className="text-muted-foreground">
                          {item.value} ({item.percentage}%)
                        </span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-6 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-500 to-blue-600 flex items-center justify-end pr-2 text-xs text-white font-medium"
                          style={{ width: `${item.percentage}%` }}
                        >
                          {item.percentage}%
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {item.description}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Total summary */}
                <div className="pt-4 border-t text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Total Filters:</span>
                    <span className="font-bold text-lg">{filterData.totalFilters}</span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="font-medium">Total Boxes:</span>
                    <span className="font-bold text-lg">{filterData.totalBoxes}</span>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="stores" className="mt-4">
              <div className="space-y-4">
                <h4 className="text-sm font-medium text-muted-foreground">
                  Top 10 Stores by Filter Count
                </h4>
                
                <div className="space-y-3">
                  {storeAnalysis.map((store, idx) => (
                    <div key={store.store} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold">
                        {idx + 1}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium">{store.store}</div>
                            <div className="text-xs text-muted-foreground">{store.chain}</div>
                          </div>
                          <div className="text-right">
                            <div className="font-semibold">{store.filters} filters</div>
                            <div className="text-xs text-muted-foreground">
                              {store.workOrders} job{store.workOrders !== 1 ? 's' : ''}
                            </div>
                          </div>
                        </div>
                        <div className="mt-1 w-full bg-muted rounded-full h-2 overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-green-500 to-green-600"
                            style={{ 
                              width: `${(store.filters / storeAnalysis[0].filters) * 100}%` 
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="chains" className="mt-4">
              <div className="space-y-4">
                <h4 className="text-sm font-medium text-muted-foreground">
                  Filter Requirements by Chain
                </h4>
                
                <div className="space-y-4">
                  {chainBreakdown.slice(0, 5).map(chain => (
                    <div key={chain.chain} className="space-y-2">
                      <h5 className="font-medium">{chain.chain}</h5>
                      <div className="grid grid-cols-2 gap-2">
                        {chain.filters.map(filter => (
                          <div 
                            key={filter.partNumber}
                            className="flex items-center justify-between p-2 bg-muted rounded-lg text-sm"
                          >
                            <span className="font-mono">{filter.partNumber}</span>
                            <span className="font-semibold">{filter.quantity}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </Card>
  );
}