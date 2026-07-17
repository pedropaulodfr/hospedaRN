import { useEffect, useState } from 'react';
import ProfileSettings from '../../components/profile/ProfileSettings';
import { establishmentsApi, uploadsApi } from '../../services/api';
import toast from 'react-hot-toast';

interface Establishment {
  id: string;
  nome: string;
  fotoPerfil?: string | null;
}

export default function EstProfile() {
  const [establishment, setEstablishment] = useState<Establishment | null>(null);
  const [uploadingFoto, setUploadingFoto] = useState(false);

  useEffect(() => {
    const loadEstablishment = async () => {
      try {
        const res = await establishmentsApi.getMy();
        const data = res.data.data || res.data || [];
        if (data.length > 0) {
          setEstablishment(data[0]);
        }
      } catch (error) {
        console.error('Erro ao carregar estabelecimento:', error);
      }
    };
    loadEstablishment();
  }, []);

  const handleFotoPerfilChange = async (file: File) => {
    if (!establishment) return;

    try {
      setUploadingFoto(true);

      const uploadRes = await uploadsApi.uploadImage('estabelecimentos', file);
      const uploaded = uploadRes.data.data || uploadRes.data;

      await establishmentsApi.update(establishment.id, { fotoPerfil: uploaded.url });

      setEstablishment((prev) => prev ? { ...prev, fotoPerfil: uploaded.url } : null);

      toast.success('Foto de perfil atualizada com sucesso!');
    } catch (error: any) {
      console.error(error);
      toast.error(error.response?.data?.message || 'Erro ao atualizar foto de perfil');
    } finally {
      setUploadingFoto(false);
    }
  };

  return (
    <ProfileSettings
      fotoPerfil={establishment?.fotoPerfil}
      estabelecimentoNome={establishment?.nome}
      onFotoPerfilChange={handleFotoPerfilChange}
      uploadingFoto={uploadingFoto}
      allowEditContact
    />
  );
}
