import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Download, ShieldCheck, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { playerApi } from '@/api/endpoints';
import { useAuth } from '@/stores/auth';
import { toast } from '@/stores/toast';
import { errorMessage } from '@/lib/errors';
import { Panel } from '@/components/ui/Panel';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Field } from '@/components/ui/Field';

/** Datenexport und Kontolöschung durch den Spieler (ADR-015, T-306). */
export function PrivacyPanel() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [exporting, setExporting] = useState(false);
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const keyword = t('account.deleteKeyword');

  async function doExport() {
    setExporting(true);
    try {
      const { blob, filename } = await playerApi.exportData();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success(t('account.exportDone'));
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setExporting(false);
    }
  }

  async function doDelete(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await playerApi.deleteAccount(password);
      // Tokens lokal verwerfen; der Server hat alle Sitzungen beendet.
      useAuth.getState().clear();
      qc.clear();
      toast.info(t('account.deleted'));
      navigate('/login', { replace: true });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const close = () => {
    setOpen(false);
    setPassword('');
    setConfirmText('');
    setError(null);
  };

  return (
    <Panel title={t('account.privacy')} icon={<ShieldCheck className="h-4 w-4" />}>
      <div className="space-y-5 text-sm">
        <div className="space-y-2">
          <p className="text-ink-muted">{t('account.exportText')}</p>
          <Button size="sm" onClick={doExport} loading={exporting}>
            <Download className="h-4 w-4" />
            {t('account.export')}
          </Button>
        </div>
        <div className="space-y-2 border-t border-line/10 pt-4">
          <p className="text-ink-muted">{t('account.deleteText')}</p>
          <Button size="sm" variant="danger" onClick={() => setOpen(true)}>
            <Trash2 className="h-4 w-4" />
            {t('account.delete')}
          </Button>
        </div>
      </div>

      <Modal
        open={open}
        onClose={close}
        title={t('account.delete')}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={close}>
              {t('app.cancel')}
            </Button>
            <Button
              variant="danger"
              type="submit"
              form="delete-account"
              loading={busy}
              disabled={!password || confirmText.trim().toUpperCase() !== keyword}
            >
              {t('account.deleteFinal')}
            </Button>
          </>
        }
      >
        <form id="delete-account" onSubmit={doDelete} className="space-y-4">
          <p className="rounded-lg border border-danger/30 bg-danger/5 p-3 text-sm text-ink-muted">
            {t('account.deleteWarning')}
          </p>
          <Field
            label={t('auth.password')}
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Field
            label={t('account.deleteConfirm', { word: keyword })}
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            autoComplete="off"
          />
          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
        </form>
      </Modal>
    </Panel>
  );
}
