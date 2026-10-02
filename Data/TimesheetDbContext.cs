using Microsoft.EntityFrameworkCore;

namespace TimesheetLite.Data;

public class TimesheetDbContext(DbContextOptions<TimesheetDbContext> options) : DbContext(options)
{
    public DbSet<TimeEntry> TimeEntries => Set<TimeEntry>();

    public DbSet<ClockifyEntryLink> ClockifyEntryLinks => Set<ClockifyEntryLink>();

    public DbSet<ClockifyProjectMap> ClockifyProjectMaps => Set<ClockifyProjectMap>();

    public DbSet<ClockifyConnection> ClockifyConnections => Set<ClockifyConnection>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<TimeEntry>(entity =>
        {
            entity.ToTable("TimeEntry", "dbo");

            entity.HasKey(x => x.Id);

            entity.Property(x => x.WorkDate)
                .HasColumnType("date");

            entity.Property(x => x.Project)
                .HasMaxLength(100)
                .IsRequired();

            entity.Property(x => x.Task)
                .HasMaxLength(100)
                .IsRequired();

            entity.Property(x => x.StartTime)
                .HasColumnType("time(0)");

            entity.Property(x => x.EndTime)
                .HasColumnType("time(0)");

            entity.Property(x => x.Hours)
                .HasPrecision(5, 2);

            entity.Property(x => x.Notes)
                .HasMaxLength(1000);

            entity.Property(x => x.CreatedDate)
                .HasDefaultValueSql("SYSDATETIMEOFFSET()");

            entity.Property(x => x.UpdatedDate)
                .HasDefaultValueSql("SYSDATETIMEOFFSET()");

            entity.HasIndex(x => x.WorkDate)
                .HasDatabaseName("IX_TimeEntry_WorkDate");

            entity.HasIndex(x => new { x.Project, x.WorkDate })
                .HasDatabaseName("IX_TimeEntry_Project_WorkDate");
        });

        modelBuilder.Entity<ClockifyEntryLink>(entity =>
        {
            entity.ToTable("ClockifyEntryLink", "dbo");

            entity.HasKey(x => x.TimeEntryId);

            entity.Property(x => x.TimeEntryId)
                .ValueGeneratedNever();

            entity.Property(x => x.WorkDate)
                .HasColumnType("date");

            entity.Property(x => x.WorkspaceId)
                .HasMaxLength(40)
                .IsRequired();

            entity.Property(x => x.ClockifyEntryId)
                .HasMaxLength(40)
                .IsRequired();

            entity.Property(x => x.Fingerprint)
                .HasMaxLength(64)
                .IsRequired();

            entity.Property(x => x.Label)
                .HasMaxLength(200)
                .IsRequired();

            entity.Property(x => x.SyncedAt)
                .HasDefaultValueSql("SYSDATETIMEOFFSET()");

            entity.HasIndex(x => x.WorkDate)
                .HasDatabaseName("IX_ClockifyEntryLink_WorkDate");
        });

        modelBuilder.Entity<ClockifyProjectMap>(entity =>
        {
            entity.ToTable("ClockifyProjectMap", "dbo");

            entity.HasKey(x => x.Project);

            entity.Property(x => x.Project)
                .HasMaxLength(100);

            entity.Property(x => x.ClockifyProjectId)
                .HasMaxLength(40)
                .IsRequired();
        });

        modelBuilder.Entity<ClockifyConnection>(entity =>
        {
            entity.ToTable("ClockifyConnection", "dbo");

            entity.HasKey(x => x.Id);

            entity.Property(x => x.Id)
                .ValueGeneratedNever();

            entity.Property(x => x.ProtectedApiKey)
                .IsRequired();

            entity.Property(x => x.SavedAt)
                .HasDefaultValueSql("SYSDATETIMEOFFSET()");
        });
    }
}
