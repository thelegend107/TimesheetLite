IF OBJECT_ID(N'[dbo].[vTimeEntryWeeklySummary]', N'V') IS NOT NULL
    DROP VIEW [dbo].[vTimeEntryWeeklySummary];
GO

IF OBJECT_ID(N'[dbo].[TimeEntry]', N'U') IS NULL
BEGIN
    CREATE TABLE [dbo].[TimeEntry]
    (
        [Id] INT IDENTITY(1,1) NOT NULL CONSTRAINT [PK_TimeEntry] PRIMARY KEY CLUSTERED,
        [WorkDate] DATE NOT NULL,
        [Project] NVARCHAR(100) NOT NULL,
        [Task] NVARCHAR(100) NOT NULL,
        [StartTime] TIME(0) NULL,
        [EndTime] TIME(0) NULL,
        [Hours] DECIMAL(5,2) NOT NULL,
        [Notes] NVARCHAR(1000) NULL,
        [CreatedDate] DATETIMEOFFSET NOT NULL CONSTRAINT [DF_TimeEntry_CreatedDate] DEFAULT SYSDATETIMEOFFSET(),
        [UpdatedDate] DATETIMEOFFSET NOT NULL CONSTRAINT [DF_TimeEntry_UpdatedDate] DEFAULT SYSDATETIMEOFFSET(),

        CONSTRAINT [CK_TimeEntry_Hours] CHECK ([Hours] > 0 AND [Hours] <= 24)
    );
END;
GO

IF COL_LENGTH(N'[dbo].[TimeEntry]', N'Task') IS NOT NULL
BEGIN
    UPDATE [dbo].[TimeEntry]
    SET [Task] = N''
    WHERE [Task] IS NULL;

    IF EXISTS
    (
        SELECT 1
        FROM [sys].[columns]
        WHERE [object_id] = OBJECT_ID(N'[dbo].[TimeEntry]')
          AND [name] = N'Task'
          AND [is_nullable] = 1
    )
    BEGIN
        ALTER TABLE [dbo].[TimeEntry]
        ALTER COLUMN [Task] NVARCHAR(100) NOT NULL;
    END;
END;
GO

IF COL_LENGTH(N'[dbo].[TimeEntry]', N'StartTime') IS NULL
BEGIN
    ALTER TABLE [dbo].[TimeEntry]
    ADD [StartTime] TIME(0) NULL;
END;
GO

IF COL_LENGTH(N'[dbo].[TimeEntry]', N'EndTime') IS NULL
BEGIN
    ALTER TABLE [dbo].[TimeEntry]
    ADD [EndTime] TIME(0) NULL;
END;
GO

IF NOT EXISTS
(
    SELECT 1
    FROM [sys].[indexes]
    WHERE [name] = N'IX_TimeEntry_WorkDate'
      AND [object_id] = OBJECT_ID(N'[dbo].[TimeEntry]')
)
BEGIN
    CREATE INDEX [IX_TimeEntry_WorkDate]
    ON [dbo].[TimeEntry] ([WorkDate]);
END;
GO

IF NOT EXISTS
(
    SELECT 1
    FROM [sys].[indexes]
    WHERE [name] = N'IX_TimeEntry_Project_WorkDate'
      AND [object_id] = OBJECT_ID(N'[dbo].[TimeEntry]')
)
BEGIN
    CREATE INDEX [IX_TimeEntry_Project_WorkDate]
    ON [dbo].[TimeEntry] ([Project], [WorkDate]);
END;
GO

CREATE VIEW [dbo].[vTimeEntryWeeklySummary]
AS
SELECT
    CAST(DATEADD(DAY, -DATEDIFF(DAY, 0, [WorkDate]) % 7, [WorkDate]) AS DATE) AS [WeekStart],
    [Project],
    SUM([Hours]) AS [TotalHours]
FROM [dbo].[TimeEntry]
GROUP BY
    CAST(DATEADD(DAY, -DATEDIFF(DAY, 0, [WorkDate]) % 7, [WorkDate]) AS DATE),
    [Project];
GO
