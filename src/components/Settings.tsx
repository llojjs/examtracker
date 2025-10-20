import React, { useState } from 'react';
import { Download, Upload, Settings as SettingsIcon, Trash2 } from 'lucide-react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Slider } from './ui/slider';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from './ui/alert-dialog';
import { toast } from 'sonner@2.0.3';
import { UserSettings } from '../types/exam';
import { exportData, importData } from '../utils/storage';

interface SettingsProps {
  settings: UserSettings;
  onSettingsChange: (settings: UserSettings) => void;
  onClearData: () => void;
}

export function Settings({ settings, onSettingsChange, onClearData }: SettingsProps) {
  const [fontSize, setFontSize] = useState(settings.fontSize);

  const handleExport = () => {
    try {
      const data = exportData();
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `examtracker-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Data exporterad!', {
        description: 'Din backup har laddats ner.'
      });
    } catch (error) {
      toast.error('Export misslyckades', {
        description: 'Kunde inte exportera data.'
      });
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const success = importData(text);
      
      if (success) {
        toast.success('Data importerad!', {
          description: 'Din backup har återställts. Ladda om sidan för att se ändringarna.'
        });
        setTimeout(() => window.location.reload(), 2000);
      } else {
        toast.error('Import misslyckades', {
          description: 'Filen verkar vara korrupt.'
        });
      }
    } catch (error) {
      toast.error('Import misslyckades', {
        description: 'Kunde inte läsa filen.'
      });
    }
  };

  const handleFontSizeChange = (value: number[]) => {
    const newSize = value[0];
    setFontSize(newSize);
    onSettingsChange({ ...settings, fontSize: newSize });
    document.documentElement.style.setProperty('--font-size', `${newSize}px`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2>Inställningar</h2>
        <p className="text-muted-foreground mt-2">
          Anpassa appen efter dina preferenser
        </p>
      </div>

      {/* Appearance */}
      <Card className="p-6">
        <h3 className="mb-4">Utseende</h3>
        
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label>Mörkt läge</Label>
              <p className="text-sm text-muted-foreground">
                Växla mellan ljust och mörkt tema
              </p>
            </div>
            <Switch
              checked={settings.theme === 'dark'}
              onCheckedChange={(checked) => {
                const newTheme = checked ? 'dark' : 'light';
                onSettingsChange({ ...settings, theme: newTheme });
                if (checked) {
                  document.documentElement.classList.add('dark');
                } else {
                  document.documentElement.classList.remove('dark');
                }
              }}
            />
          </div>

          <div className="space-y-3">
            <Label>Typsnittsstorlek: {fontSize}px</Label>
            <Slider
              value={[fontSize]}
              onValueChange={handleFontSizeChange}
              min={12}
              max={20}
              step={1}
              className="w-full"
            />
            <p className="text-sm text-muted-foreground">
              Justera läsbarheten genom att ändra typsnittsstorlek
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label>Kompakt vy</Label>
              <p className="text-sm text-muted-foreground">
                Visa mer innehåll på skärmen
              </p>
            </div>
            <Switch
              checked={settings.compactView}
              onCheckedChange={(checked) => 
                onSettingsChange({ ...settings, compactView: checked })
              }
            />
          </div>
        </div>
      </Card>

      {/* Language */}
      <Card className="p-6">
        <h3 className="mb-4">Språk</h3>
        
        <div className="space-y-3">
          <Label>Gränssnittsspråk</Label>
          <Select 
            value={settings.language} 
            onValueChange={(value: 'sv' | 'en') => 
              onSettingsChange({ ...settings, language: value })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sv">Svenska</SelectItem>
              <SelectItem value="en">English</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground">
            Byt språk för hela applikationen
          </p>
        </div>
      </Card>

      {/* Data Management */}
      <Card className="p-6">
        <h3 className="mb-4">Datahantering</h3>
        
        <div className="space-y-4">
          <div>
            <Label className="mb-2 block">Exportera data</Label>
            <Button onClick={handleExport} variant="outline" className="w-full">
              <Download className="w-4 h-4 mr-2" />
              Ladda ner backup (JSON)
            </Button>
            <p className="text-sm text-muted-foreground mt-2">
              Spara alla tentor, anteckningar och inställningar
            </p>
          </div>

          <div>
            <Label className="mb-2 block">Importera data</Label>
            <Button asChild variant="outline" className="w-full">
              <label className="cursor-pointer">
                <Upload className="w-4 h-4 mr-2" />
                Återställ från backup
                <input
                  type="file"
                  accept="application/json"
                  className="hidden"
                  onChange={handleImport}
                />
              </label>
            </Button>
            <p className="text-sm text-muted-foreground mt-2">
              Återställ data från en tidigare backup
            </p>
          </div>

          <div>
            <Label className="mb-2 block">Rensa all data</Label>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="w-full">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Radera allt
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Är du säker?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Detta kommer att permanent radera alla dina tentor, anteckningar och inställningar.
                    Denna åtgärd kan inte ångras.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Avbryt</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => {
                      onClearData();
                      toast.success('Data raderad', {
                        description: 'All data har raderats från appen.'
                      });
                    }}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Radera allt
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <p className="text-sm text-muted-foreground mt-2">
              ⚠️ Denna åtgärd kan inte ångras
            </p>
          </div>
        </div>
      </Card>

      {/* About */}
      <Card className="p-6 bg-muted/50">
        <h4 className="mb-2">Om ExamTracker</h4>
        <p className="text-sm text-muted-foreground">
          Version 1.0.0 • Skapad med React och Tailwind CSS
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          Alla data lagras lokalt i din webbläsare (localStorage).
        </p>
      </Card>
    </div>
  );
}
