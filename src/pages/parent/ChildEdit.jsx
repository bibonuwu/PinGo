import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from '../../hooks/useLiveQuery';
import { FloppyDiskIcon } from '@phosphor-icons/react';
import { db } from '../../lib/db';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { childIssues, updateChild } from '../../services/children';
import { AvatarPicker } from '../../components/Avatar';
import { AboutFields, GoalsFields, NeedsFields, StyleFields } from '../../components/ChildForm';
import { PageHeader } from '../../components/PageHeader';
import { Button } from '../../components/ui';

export default function ChildEdit() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const child = useLiveQuery(async () => (await db.children.get(id)) ?? null, [id]);
  const [data, setData] = useState(null);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (child && !data) setData(child);
  }, [child, data]);

  if (child === undefined || (child && !data)) return <div className="page page--loading" />;
  if (!child || child.parentId !== user.id) return <Navigate to="/parent/profile" replace />;

  const set = (patch) => {
    setData((d) => ({ ...d, ...patch }));
    setErrors({});
  };

  const save = async () => {
    const issues = childIssues(data);
    if (Object.keys(issues).length) {
      setErrors(issues);
      toast.error(Object.values(issues)[0]);
      return;
    }
    setBusy(true);
    try {
      await updateChild(id, data);
      toast.success('Профиль сохранён');
      navigate(`/parent/children/${id}`, { replace: true });
    } catch (e) {
      toast.error(e.message);
      setBusy(false);
    }
  };

  return (
    <div className="page form-page">
      <PageHeader back={`/parent/children/${id}`} title={`Профиль: ${child.name}`} />
      <section className="card-section">
        <h2>Аватар</h2>
        <AvatarPicker value={data.avatar} onChange={(avatar) => set({ avatar })} size={64} />
      </section>
      <section className="card-section">
        <h2>Имя и возраст</h2>
        <AboutFields data={data} set={set} errors={errors} />
      </section>
      <section className="card-section">
        <h2>Потребности</h2>
        <NeedsFields data={data} set={set} errors={errors} />
      </section>
      <section className="card-section">
        <h2>Стиль обучения</h2>
        <StyleFields data={data} set={set} />
      </section>
      <section className="card-section">
        <h2>Цели и важное</h2>
        <GoalsFields data={data} set={set} />
      </section>
      <div className="form-actions">
        <Button variant="soft" size="lg" onClick={() => navigate(`/parent/children/${id}`)}>
          Отмена
        </Button>
        <Button variant="dark" size="lg" icon={FloppyDiskIcon} onClick={save} loading={busy}>
          Сохранить
        </Button>
      </div>
    </div>
  );
}
