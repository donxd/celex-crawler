const Sequelize = require('sequelize');
const {DataTypes, Op} = Sequelize;

class Persistence {
    processData (data) {
        const dataCourses = data.reduce((acc, v) => acc.add(v.language), new Set());
        const dataGrades = data.reduce((acc, v) => acc.add(v.level), new Set());
        const dataTeachers = data.reduce((acc, v) => acc.add(v.teacher), new Set());
        const dataStudents = data.reduce((acc, v) => new Set(Array.from(acc).concat(v.students)), new Set());

        const sequelize = this.getConnection();
        this.configEntities(sequelize);

        Promise.all([
            this.getCoursesPersisted(dataCourses),
            this.getGradesPersisted(dataGrades),
            this.getTeachersPersisted(dataTeachers),
            this.getStudentsPersisted(dataStudents),
        ]).then(([courses, grades, teachers, students]) => {
            let processCourses = this.processCourses(courses, dataCourses);
            let processGrades = this.processGrades(grades, dataGrades);
            let processTeachers = this.processTeachers(teachers, dataTeachers);
            let processStudents = this.processStudents(students, dataStudents);

            this.generateNewInfo(processCourses, processGrades, processTeachers, processStudents, sequelize, data)
                .then(res => console.log('transaction - done') || sequelize.close())
                .catch(err => console.log('transaction - error : ', err) || sequelize.close());
        }).catch(err => console.log('error : ', err) || sequelize.close());
    }

    generateNewInfo (processCourses, processGrades, processTeachers, processStudents, sequelize, data) {
        return sequelize.transaction().then(tx => Promise.all([
            this.createNewCourses(processCourses, tx),
            this.createNewGrades(processGrades, tx),
            this.createNewTeachers(processTeachers, tx),
            this.createNewStudents(processStudents, tx),
        ]).then(([newCourses, newGrades, newTeachers, newStudents]) => {
            this.joinNewData(processCourses, newCourses, this.processCourses);
            this.joinNewData(processGrades, newGrades, this.processGrades);
            this.joinNewData(processTeachers, newTeachers, this.processTeachers);
            this.joinNewData(processStudents, newStudents, this.processStudents);
            return new Promise(solve => solve());
        }).then(async() => {
            const groups = await this.getGroups(processCourses, processGrades, processTeachers, processStudents, data, tx);
            tx.commit();
            console.log('new data - done');
        }).catch(err => {
            tx.rollback();
            console.log('new data - undone - err : ', err);
        }));
    }

    getGroups (processCourses, processGrades, processTeachers, processStudents, data, tx) {
        const dataPersisted = this.getDataPersisted(processCourses, processGrades, processTeachers, processStudents);
        const groups = [];

        for (let group of data) {
            groups.push(this.buildGroup(dataPersisted, group));
        }

        return this.getNewGroups(groups)
            .then(newGroups => this.createNewGroups(newGroups, tx))
            .then(groupsPersisted => this.getGroupsProcess(groups, tx))
            .then(groupsProcess => this.analyzeGroups(groupsProcess));
    }

    analyzeGroups (groupsProcess) {
        console.log('# groupsProcess : ', groupsProcess.length);
    }

    getGroupsProcess (groups, tx) {
        const filter = this.getGroupsFilter(groups);

        filter.lock = true;
        filter.transaction = tx;
        filter.include = [
            this.GroupCourse,
            this.GroupGrade,
            this.GroupTeacher,
            this.Group.Student
        ];

        return this.Group.findAll(filter);
    }

    createNewGroups (newGroups, tx) {
        let data = Array.from(newGroups.values()).map(newGroup => {
            delete newGroup.grouper;

            newGroup.relationStudents = newGroup.students.map(student => ({idStudent: student}));
            return newGroup;
        });

        return this.Group.bulkCreate(data, {transaction: tx, include: [ {association: this.Group.RelationStudent} ] });
    }

    getNewGroups (groups) {
        const groupsControl = this.getGroupsControl(groups);

        return this.Group.findAll(this.getGroupsFilter(groups))
            .then(groupsPersisted => this.reduceGroups(groupsPersisted, groupsControl))
            .then(() => groupsControl);
    }

    reduceGroups (groupsPersisted, groupsControl) {
        return new Promise(solve => {
            for (let groupPersisted of groupsPersisted) {
                let grouper = this.getGrouper(groupPersisted.dataValues);
                groupsControl.delete(grouper);
            }
            solve();
        });
    }

    getGrouper (group) {
        return `${group.idCourse}.${group.idGrade}.${group.idTeacher}.${group.bimester}.${group.schedule}`;
    }

    getGroupsControl (groups) {
        return groups.reduce((acc, group) =>
            acc.set(this.getGrouper(group), group)
        , new Map());
    }

    getGroupsFilter (groups) {
        return {
            where: {
                [Op.or]: groups.map(group => ({
                    idCourse: group.idCourse,
                    idGrade: group.idGrade,
                    idTeacher: group.idTeacher,
                    bimester: group.bimester,
                    schedule: group.schedule
                }))
            }
        };
    }

    buildGroup (dataPersisted, group) {
        const dataGroup = {
            schedule: group.schedule,
            publication: group.publication,
            bimester: group.semester,
            classroom: group.classroom,
            idCourse: this.getIdCourse(dataPersisted.courses, group.language),
            idGrade: this.getIdGrade(dataPersisted.grades, group.level),
            idTeacher: this.getIdTeacher(dataPersisted.teachers, group.teacher),
            students: this.getGroupStudents(dataPersisted.students, group.students),
        };
        dataGroup.grouper = this.getGrouper(dataGroup);

        return dataGroup;
    }

    getGroupStudents (persistedStudents, students) {
        return students.map(student => persistedStudents.get(student).idStudent);
    }

    getIdCourse (persistedCourses, language) {
        return persistedCourses.get(language).idCourse;
    }

    getIdGrade (persistedGrades, grade) {
        return persistedGrades.get(grade).idGrade;
    }

    getIdTeacher (persistedTeachers, teacher) {
        return persistedTeachers.get(teacher).idTeacher;
    }

    getDataPersisted (processCourses, processGrades, processTeachers, processStudents) {
        return {
            courses : processCourses.persisted,
            grades : processGrades.persisted,
            teachers : processTeachers.persisted,
            students : processStudents.persisted
        };
    }

    joinNewData (persistedData, newPersisted, processPersistence) {
        persistedData.persisted = new Map([...persistedData.persisted, ...(processPersistence(newPersisted, new Set())).persisted]);
        persistedData.newData.clear();
    }

    createNewCourses (processCourses, tx) {
        let data = Array.from(processCourses.newData).map(element => ({name: element}));
        return this.Course.bulkCreate(data, {transaction: tx});
    }

    createNewGrades (processGrades, tx) {
        let data = Array.from(processGrades.newData).map(element => ({name: element}));
        return this.Grade.bulkCreate(data, {transaction: tx});
    }

    createNewTeachers (processTeachers, tx) {
        let data = Array.from(processTeachers.newData).map(element => ({name: element}));
        return this.Teacher.bulkCreate(data, {transaction: tx});
    }

    createNewStudents (processStudents, tx) {
        let data = Array.from(processStudents.newData).map(element => ({name: element}));
        return this.Student.bulkCreate(data, {transaction: tx});
    }

    processCourses (courses, dataCourses) {
        let persisted = new Map();

        for (let course of courses) {
            persisted.set(course.dataValues.name, course.dataValues);
            if (dataCourses.has(course.dataValues.name)) dataCourses.delete(course.dataValues.name);
        }

        return {
            newData : dataCourses,
            persisted
        };
    }

    processGrades (grades, dataGrades) {
        let persisted = new Map();

        for (let grade of grades) {
            persisted.set(grade.dataValues.name, grade.dataValues);
            if (dataGrades.has(grade.dataValues.name)) dataGrades.delete(grade.dataValues.name);
        }

        return {
            newData : dataGrades,
            persisted
        };
    }

    processTeachers (teachers, dataTeachers) {
        let persisted = new Map();

        for (let teacher of teachers) {
            persisted.set(teacher.dataValues.name, teacher.dataValues);
            if (dataTeachers.has(teacher.dataValues.name)) dataTeachers.delete(teacher.dataValues.name);
        }

        return {
            newData : dataTeachers,
            persisted
        };
    }

    processStudents (students, dataStudents) {
        let persisted = new Map();

        for (let student of students) {
            persisted.set(student.dataValues.name, student.dataValues);
            if (dataStudents.has(student.dataValues.name)) dataStudents.delete(student.dataValues.name);
        }

        return {
            newData : dataStudents,
            persisted
        };
    }

    getCoursesPersisted (dataCourses) {
        return this.Course.findAll({
            where: {
                name: {
                    [Op.or]: Array.from(dataCourses)
                }
            }
        });
    }

    getGradesPersisted (dataGrade) {
        return this.Grade.findAll({
            where: {
                name: {
                    [Op.or]: Array.from(dataGrade)
                }
            }
        });
    }

    getTeachersPersisted (dataTeachers) {
        return this.Teacher.findAll({
            where: {
                name: {
                    [Op.or]: Array.from(dataTeachers)
                }
            }
        });
    }

    getStudentsPersisted (dataStudents) {
        return this.Student.findAll({
            where: {
                name: {
                    [Op.or]: Array.from(dataStudents)
                }
            }
        });
    }

    getConnection () {
        return new Sequelize({
            database: process.env.DB || 'celex',
            username: process.env.USR || 'root',
            host: process.env.HT || '172.17.0.2',
            port: process.env.PT || '3306',
            password: process.env.PW || 'pruebas',
            define: {
                timestamps: false
            },
            isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.READ_UNCOMMITTED,
            logging: false,
            dialect: process.env.DD || 'mysql'
        });
    }

    configEntities (sequelize) {
        this.Course = this.configEntityCourses(sequelize);
        this.Grade = this.configEntityGrades(sequelize);
        this.Student = this.configEntityStudents(sequelize);
        this.Teacher = this.configEntityTeachers(sequelize);
        this.Group = this.configEntityGroups(sequelize);

        this.GroupCourse = this.Group.belongsTo(this.Course, {as: 'course', foreignKey: 'id_course'});
        this.GroupGrade = this.Group.belongsTo(this.Grade, {as: 'grade', foreignKey: 'id_grade'});
        this.GroupTeacher = this.Group.belongsTo(this.Teacher, {as: 'teacher', foreignKey: 'id_teacher'});

        this.GroupStudent = this.configEntityGroupStudent(sequelize);
        this.GroupStudent.removeAttribute('id');

        this.Group.RelationStudent = this.Group.hasMany(this.GroupStudent, {as: 'relationStudents', foreignKey: 'id_group'});

        this.Group.Student = this.Group.belongsToMany(this.Student, {as: 'students', through: this.GroupStudent, foreignKey: 'id_group', otherKey: 'id_student'}); 
    }

    configEntityCourses (sequelize) {
        return sequelize.define('course', {
            idCourse : {
                field: 'id_course',
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            name : {
                field: 'name',
                type: DataTypes.STRING,
                allowNull: false
            }
        });
    }

    configEntityGrades (sequelize) {
        return sequelize.define('grade', {
            idGrade : {
                field: 'id_grade',
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            name : {
                field: 'name',
                type: DataTypes.STRING,
                allowNull: false
            }
        });
    }

    configEntityStudents (sequelize) {
        return sequelize.define('student', {
            idStudent : {
                field: 'id_student',
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            name : { 
                field: 'name',
                type: DataTypes.STRING,
                allowNull: false
            }
        });
    }

    configEntityTeachers (sequelize) {
        return sequelize.define('teacher', {
            idTeacher : {
                field: 'id_teacher',
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            name : {
                field: 'name',
                type: DataTypes.STRING,
                allowNull: false
            }
        });
    }

    configEntityGroups (sequelize) {
        return sequelize.define('group', {
            idGroup : {
                field: 'id_group',
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            schedule : {
                field: 'schedule',
                type: DataTypes.STRING,
                allowNull: false
            },
            publication : {
                field: 'publication',
                type: DataTypes.DATE,
                allowNull: false
            },
            bimester : {
                field: 'bimester',
                type: DataTypes.STRING,
                allowNull: false
            },
            classroom : {
                field: 'classroom',
                type: DataTypes.STRING,
                allowNull: false
            },
            idCourse : {
                field: 'id_course',
                type: DataTypes.INTEGER,
                allowNull: false
            },
            idGrade : {
                field: 'id_grade',
                type: DataTypes.INTEGER,
                allowNull: false
            },
            idTeacher : {
                field: 'id_teacher',
                type: DataTypes.INTEGER,
                allowNull: false
            }
        });
    }

    configEntityGroupStudent (sequelize) {
        return sequelize.define('groupStudent', {
            idStudent : { 
                field: 'id_student',
                type: DataTypes.INTEGER,
                allowNull: false
            }
        }, {
            tableName: 'group_student'
        });
    }
}

module.exports = Persistence;