import TeamMembers from "@/components/TeamMembers";
import PendingMembers from "@/components/PendingMembers";

const AdminTeam = () => {
  return (
    <div className="space-y-6">
      <PendingMembers />
      <TeamMembers />
    </div>
  );
};

export default AdminTeam;
