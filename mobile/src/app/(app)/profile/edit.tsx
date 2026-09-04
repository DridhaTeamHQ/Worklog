import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useUser } from '@/auth/store';
import { useUpdateProfile } from '@/hooks/useProfile';
import { ApiError, errorMessage } from '@/api/client';
import { PillButton, Screen, ScreenHeader, Text, TextField, useToast } from '@/components';

export default function EditProfile() {
  const router = useRouter();
  const toast = useToast();
  const user = useUser();
  const update = useUpdateProfile();
  const [name, setName] = useState(user?.name ?? '');
  const [jobTitle, setJobTitle] = useState(user?.job_title ?? '');
  const [department, setDepartment] = useState(user?.department ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const submit = () => {
    if (!name.trim()) { setErrors({ name: 'Your name is required.' }); return; }
    setErrors({});
    update.mutate({ name: name.trim(), jobTitle: jobTitle.trim() || null, department: department.trim() || null, phone: phone.trim() || null }, {
      onSuccess: () => { toast.success('Profile updated'); router.back(); },
      onError: (err) => {
        if (err instanceof ApiError && err.details?.length) setErrors(err.fieldErrors);
        else toast.error('Could not save', errorMessage(err));
      },
    });
  };

  return (
    <Screen>
      <ScreenHeader title="Edit profile" />
      <View style={{ gap: 16 }}>
        <TextField label="Full name" required value={name} onChangeText={setName} error={errors.name} textContentType="name" />
        <TextField label="Email" value={user?.email ?? ''} editable={false} hint="Managed by your admin." />
        <TextField label="Job title" value={jobTitle} onChangeText={setJobTitle} error={errors.jobTitle} />
        <TextField label="Department" value={department} onChangeText={setDepartment} error={errors.department} />
        <TextField label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" textContentType="telephoneNumber" error={errors.phone} />
        <PillButton label="Save changes" size="lg" block onPress={submit} loading={update.isPending} />
        <Text variant="small" color="inkFaint" align="center">Your timezone is set from this phone automatically.</Text>
      </View>
    </Screen>
  );
}
